// Definerer API-rutene for nyheter, inkludert bildeopplasting og arkivering
import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  deleteUpload,
  readStore,
  readUpload,
  saveUpload,
  updateStore,
} from "../lib/store.js";
import { recordAudit } from "../lib/audit.js";
import { adminSession, requireAdmin } from "./auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const statuses = new Set(["published", "draft", "archived"]);
const imageSignatures = [
  {
    extension: ".png",
    contentType: "image/png",
    matches: (buffer) =>
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    extension: ".jpg",
    contentType: "image/jpeg",
    matches: (buffer) =>
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    extension: ".webp",
    contentType: "image/webp",
    matches: (buffer) =>
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP",
  },
];

function parseNewsImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Nyhetsbilder kan være på maksimalt 5 MB"
        : error.code === "LIMIT_UNEXPECTED_FILE"
          ? "Bare ett nyhetsbilde er tillatt"
          : "Opplasting av nyhetsbildet er ugyldig";
    res.status(400).json({ message });
  });
}

function getNewsId(req, res) {
  const newsId = Number(req.params.id);
  if (Number.isSafeInteger(newsId) && newsId > 0) return newsId;
  res.status(400).json({ message: "Nyhets-ID-en er ugyldig" });
  return null;
}

function readNewsData(req, res) {
  let item = req.body;
  if (typeof req.body?.news === "string") {
    try {
      item = JSON.parse(req.body.news);
    } catch {
      res.status(400).json({ message: "Nyhetsdetaljene må være gyldig JSON" });
      return null;
    }
  }
  const textFields = ["title", "category", "summary", "text", "date"];
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item) ||
    textFields.some(
      (field) => typeof item[field] !== "string" || !item[field].trim(),
    )
  ) {
    res.status(400).json({ message: "Fyll ut alle obligatoriske nyhetsfelt." });
    return null;
  }

  const imageUrl = item.imageUrl ?? "";
  // Tillat bare lokale stier eller HTTPS-adresser; avvis protokoll-relative og stitraverserende adresser
  const validImageUrl =
    typeof imageUrl === "string" &&
    imageUrl.length <= 1000 &&
    (!imageUrl ||
      (/^\/(?!\/)[^\s]*$/.test(imageUrl) &&
        !imageUrl.includes("..")) ||
      /^https:\/\/[^\s]+$/i.test(imageUrl));
  const date = new Date(`${item.date}T00:00:00.000Z`);
  if (
    item.title.length > 160 ||
    item.category.length > 80 ||
    item.summary.length > 500 ||
    item.text.length > 12000 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== item.date ||
    !validImageUrl ||
    !statuses.has(item.status)
  ) {
    res.status(400).json({ message: "Et eller flere nyhetsfelt er ugyldige." });
    return null;
  }

  return {
    title: item.title.trim(),
    category: item.category.trim(),
    summary: item.summary.trim(),
    text: item.text.trim(),
    date: item.date,
    imageUrl,
    status: item.status,
  };
}

async function saveNewsImage(file) {
  if (!file) return null;
  // Filendelsen og MIME-typen bestemmes av filinnholdet, ikke klientens filnavn eller typefelt
  const signature = imageSignatures.find((item) => item.matches(file.buffer));
  if (!signature) {
    return { error: "Last opp et gyldig PNG-, JPEG- eller WebP-bilde" };
  }
  const imageStorageName = `${randomUUID()}${signature.extension}`;
  await saveUpload(
    path.join("news-images", imageStorageName),
    file.buffer,
    signature.contentType,
  );
  return {
    imageStorageName,
    imageUrl: `/api/news/images/${imageStorageName}`,
  };
}

router.get("/images/:imageName", async (req, res, next) => {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(req.params.imageName)) {
    return res.status(404).json({ message: "Nyhetsbildet ble ikke funnet" });
  }
  try {
    const signature = imageSignatures.find((item) =>
      req.params.imageName.endsWith(item.extension),
    );
    const content = await readUpload(
      path.join("news-images", req.params.imageName),
    );
    if (!content) {
      return res.status(404).json({ message: "Nyhetsbildet ble ikke funnet" });
    }
    res.set("Content-Type", signature.contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(content);
  } catch (error) {
    next(error);
  }
});

router.get("/", (req, res) => {
  const items = readStore().news;
  // Statusfiltreringen skjer også på serveren, ikke bare i visningen i nettleseren
  res.json(
    req.query.scope === "all" && adminSession(req)
      ? items
      : items.filter((item) => item.status === "published"),
  );
});

router.get("/:id", (req, res) => {
  const newsId = getNewsId(req, res);
  if (!newsId) return;
  const item = readStore().news.find((entry) => entry.id === newsId);
  if (!item || (item.status !== "published" && !adminSession(req))) {
    return res.status(404).json({ message: "Nyheten ble ikke funnet" });
  }
  res.json(item);
});

router.post("/", requireAdmin, parseNewsImage, async (req, res, next) => {
  const newsData = readNewsData(req, res);
  if (!newsData) return;
  let uploadedImage;
  try {
    uploadedImage = await saveNewsImage(req.file);
    if (uploadedImage?.error) {
      return res.status(400).json({ message: uploadedImage.error });
    }
    const item = await updateStore((state) => {
      const newItem = {
        id: Math.max(0, ...state.news.map((entry) => entry.id)) + 1,
        ...newsData,
        ...(uploadedImage && {
          imageStorageName: uploadedImage.imageStorageName,
          imageUrl: uploadedImage.imageUrl,
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.news.push(newItem);
      recordAudit(state, req, "news.create", {
        newsId: newItem.id,
        title: newItem.title,
      });
      return newItem;
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAdmin, parseNewsImage, async (req, res, next) => {
  const newsId = getNewsId(req, res);
  if (!newsId) return;
  const newsData = readNewsData(req, res);
  if (!newsData) return;
  let uploadedImage;
  try {
    uploadedImage = await saveNewsImage(req.file);
    if (uploadedImage?.error) {
      return res.status(400).json({ message: uploadedImage.error });
    }
    const result = await updateStore((state) => {
      const item = state.news.find((entry) => entry.id === newsId);
      if (!item) return null;
      const previousImageStorageName = item.imageStorageName;
      Object.assign(item, newsData, {
        ...(uploadedImage && {
          imageStorageName: uploadedImage.imageStorageName,
          imageUrl: uploadedImage.imageUrl,
        }),
        updatedAt: new Date().toISOString(),
      });
      recordAudit(state, req, "news.update", {
        newsId,
        title: item.title,
        status: item.status,
      });
      return { item, previousImageStorageName };
    });
    if (!result) {
      // En opplastet fil uten tilhørende nyhetsoppføring skal ikke bli liggende foreldreløs
      if (uploadedImage) {
        await deleteUpload(
          path.join("news-images", uploadedImage.imageStorageName),
        );
      }
      return res.status(404).json({ message: "Nyheten ble ikke funnet" });
    }
    if (uploadedImage && result.previousImageStorageName) {
      // Behold forrige bilde dersom ingen ny fil ble sendt med forespørselen
      await deleteUpload(
        path.join("news-images", result.previousImageStorageName),
      );
    }
    res.json(result.item);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  const newsId = getNewsId(req, res);
  if (!newsId) return;
  try {
    const item = await updateStore((state) => {
      const existingItem = state.news.find((entry) => entry.id === newsId);
      if (!existingItem) return null;
      // Arkivering bevarer innholdet i administratorens arkiv
      existingItem.status = "archived";
      existingItem.updatedAt = new Date().toISOString();
      recordAudit(state, req, "news.archive", {
        newsId,
        title: existingItem.title,
      });
      return existingItem;
    });
    if (!item) return res.status(404).json({ message: "Nyheten ble ikke funnet" });
    res.json({ message: "Nyheten er arkivert" });
  } catch (error) {
    next(error);
  }
});

export default router;
