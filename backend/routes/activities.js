import express from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  deleteUpload,
  readStore,
  readUpload,
  saveUpload,
  updateStore,
} from "../lib/store.js";
import {
  activityStatuses,
  confirmedOrders,
  isPublished,
  remainingTickets,
} from "../lib/pricing.js";
import { recordAudit } from "../lib/audit.js";
import { shouldArchive } from "../lib/contentArchive.js";
import { memberEmail, memberName } from "../lib/members.js";
import { adminSession, requireAdmin } from "./auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const allowedMemberTypes = new Set(["regular", "minor", "gift", "craft"]);
const discountMemberTypes = new Set(["regular", "minor", "craft"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function validateDiscount(discount) {
  if (discount == null) return { value: null };
  const { type, memberTypes, startDate = "", endDate = "" } = discount;
  const value = Number(discount.value);
  const validDates = [startDate, endDate].every(
    (date) =>
      date === "" ||
      (isoDatePattern.test(date) && !Number.isNaN(Date.parse(date))),
  );
  const valueLimit = type === "percent" ? 100 : 1000000;
  if (
    !["percent", "amount"].includes(type) ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > valueLimit ||
    !Array.isArray(memberTypes) ||
    memberTypes.length < 1 ||
    memberTypes.some((memberType) => !discountMemberTypes.has(memberType)) ||
    !validDates ||
    (startDate && endDate && startDate > endDate)
  ) {
    return {
      error:
        "Rabatten må ha gyldig type, beløp, medlemstyper og en periode der startdatoen ikke er etter sluttdatoen",
    };
  }
  return {
    value: {
      type,
      value,
      memberTypes: [...new Set(memberTypes)],
      startDate,
      endDate,
    },
  };
}
const ticketTypeLimit = 20;
const supportedImageSignatures = [
  {
    extension: ".png",
    matches: (buffer) =>
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    extension: ".jpg",
    matches: (buffer) =>
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    extension: ".webp",
    matches: (buffer) =>
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP",
  },
];

function parseActivityImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    const uploadErrorMessages = {
      LIMIT_FILE_SIZE: "Aktivitetsbilder kan være på maksimalt 5 MB",
      LIMIT_UNEXPECTED_FILE: "Bare ett aktivitetsbilde er tillatt",
    };
    res.status(400).json({
      message:
        uploadErrorMessages[error.code] ||
        "Opplasting av aktivitetsbildet er ugyldig",
    });
  });
}

const allowedDescriptionTags = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
]);

function sanitizeDescriptionToken(token) {
  if (!token.startsWith("<")) {
    return token.replaceAll("&", "&amp;").replaceAll(">", "&gt;");
  }
  const tagMatch = token.match(
    /^<\s*(\/?)\s*([a-z0-9]+)(?:\s+[^>]*)?\s*\/?>$/i,
  );
  if (!tagMatch)
    return token
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const [, closingMarker, rawTagName] = tagMatch;
  const tagName = rawTagName.toLowerCase();
  if (tagName === "font") {
    const fontSize = token.match(/\bsize\s*=\s*["']?([1-7])["']?/i)?.[1];
    if (!fontSize) return "";
    return closingMarker ? "</font>" : `<font size="${fontSize}">`;
  }
  if (!allowedDescriptionTags.has(tagName)) return "";
  return closingMarker ? `</${tagName}>` : `<${tagName}>`;
}

function sanitizeActivityDescription(descriptionHtml) {
  if (typeof descriptionHtml !== "string" || descriptionHtml.length > 12000) {
    return { error: "Beskrivelsen må være tekst på maksimalt 12 000 tegn" };
  }
  const sanitizedHtml =
    descriptionHtml
      .match(/<[^>]*>|[^<]+/g)
      ?.map(sanitizeDescriptionToken)
      .join("") || "";
  return { value: sanitizedHtml };
}

function validateTicketTypes(
  ticketTypes,
  totalCapacity,
  allowEmptyTicketTypes,
) {
  if (
    !Array.isArray(ticketTypes) ||
    (!allowEmptyTicketTypes && ticketTypes.length < 1) ||
    ticketTypes.length > ticketTypeLimit
  ) {
    return {
      error: `Legg til ${allowEmptyTicketTypes ? "maksimalt" : "mellom 1 og"} ${ticketTypeLimit} billettyper`,
    };
  }

  const normalizedNames = new Set();
  const validatedTicketTypes = [];
  for (const ticketType of ticketTypes) {
    const name =
      typeof ticketType?.name === "string" ? ticketType.name.trim() : "";
    const description =
      typeof ticketType?.description === "string"
        ? ticketType.description.trim()
        : "";
    const rawPrice = ticketType?.price;
    const price = rawPrice;
    const quantity = Number(ticketType?.quantity);
    const hasValidMemberTypes =
      Array.isArray(ticketType?.memberTypes) &&
      ticketType.memberTypes.length > 0 &&
      ticketType.memberTypes.every((memberType) =>
        allowedMemberTypes.has(memberType),
      );

    if (
      !name ||
      name.length > 100 ||
      description.length > 1000 ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 1000000 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > totalCapacity ||
      !hasValidMemberTypes
    ) {
      return {
        error:
          "Hver billett må ha et navn, positiv pris og antall, og minst én gyldig medlemskapstype",
      };
    }

    const normalizedName = name.toLocaleLowerCase("nb-NO");
    if (normalizedNames.has(normalizedName))
      return { error: "Billettypene må ha unike navn" };
    normalizedNames.add(normalizedName);
    validatedTicketTypes.push({
      name,
      description,
      price,
      quantity,
      memberTypes: [...new Set(ticketType.memberTypes)],
    });
  }

  if (
    validatedTicketTypes.reduce(
      (total, ticketType) => total + ticketType.quantity,
      0,
    ) > totalCapacity
  ) {
    return {
      error:
        "Det samlede antallet billetter kan ikke overstige aktivitetskapasiteten",
    };
  }
  return { value: validatedTicketTypes };
}

function validateActivityData(
  activityData,
  { allowEmptyTicketTypes = false } = {},
) {
  if (
    !activityData ||
    typeof activityData !== "object" ||
    Array.isArray(activityData)
  ) {
    return { error: "Aktiviteten må være et objekt" };
  }
  const title =
    typeof activityData.title === "string" ? activityData.title.trim() : "";
  const date = typeof activityData.date === "string" ? activityData.date : "";
  const location =
    typeof activityData.location === "string"
      ? activityData.location.trim()
      : "";
  const time =
    typeof activityData.time === "string" ? activityData.time.trim() : "";
  const category =
    typeof activityData.category === "string"
      ? activityData.category.trim()
      : "Aktivitet";
  const durationMinutes =
    activityData.durationMinutes == null || activityData.durationMinutes === ""
      ? null
      : Number(activityData.durationMinutes);
  if (!title || title.length > 160)
    return { error: "Tittel er påkrevd og kan være på maksimalt 160 tegn" };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    return { error: "En gyldig aktivitetsdato er påkrevd" };
  }
  if (!location || location.length > 200)
    return { error: "Sted er påkrevd og kan være på maksimalt 200 tegn" };
  if (!time) return { error: "Tidspunkt er påkrevd" };
  if (time.length > 80 || category.length > 100)
    return { error: "Tidspunktet eller kategorien er for lang" };
  if (
    durationMinutes !== null &&
    (!Number.isSafeInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440)
  ) {
    return {
      error: "Varigheten må være et helt tall mellom 1 og 1440 minutter",
    };
  }
  if (
    activityData.status !== undefined &&
    !activityStatuses.includes(activityData.status)
  ) {
    return { error: "Statusen må være publisert, utkast eller arkivert" };
  }
  const descriptionResult = sanitizeActivityDescription(
    activityData.description || "",
  );
  if (descriptionResult.error) return descriptionResult;

  const discountResult = validateDiscount(activityData.discount);
  if (discountResult.error) return discountResult;

  const totalTicketCapacity = Number(activityData.ticketCapacity);
  if (
    !Number.isSafeInteger(totalTicketCapacity) ||
    totalTicketCapacity < 1 ||
    totalTicketCapacity > 100000
  ) {
    return {
      error: "Billettkapasiteten må være et helt tall mellom 1 og 100 000",
    };
  }
  const ticketTypesResult = validateTicketTypes(
    activityData.ticketTypes,
    totalTicketCapacity,
    allowEmptyTicketTypes,
  );
  if (ticketTypesResult.error) return ticketTypesResult;
  const ticketTypes = ticketTypesResult.value;
  return {
    value: {
      title,
      date,
      time,
      durationMinutes,
      location,
      category,
      description: descriptionResult.value,
      ticketCapacity: totalTicketCapacity,
      discount: discountResult.value,
      ticketTypes,
      ...(activityData.status && { status: activityData.status }),
    },
  };
}

function readActivityData(req, res, options) {
  let activityData;
  try {
    activityData = JSON.parse(req.body?.activity || "");
  } catch {
    res
      .status(400)
      .json({ message: "Aktivitetsdetaljene må være gyldig JSON" });
    return null;
  }

  const validation = validateActivityData(activityData, options);
  if (validation.error) {
    res.status(400).json({ message: validation.error });
    return null;
  }
  return validation.value;
}

function toPublicActivity(activityData) {
  const { imageStorageName, ...publicData } = activityData;
  return {
    ...publicData,
    remainingTickets: remainingTickets(readStore(), activityData),
  };
}

function soldTicketCounts(orders) {
  const counts = new Map();
  for (const order of orders) {
    counts.set(
      order.ticketName,
      (counts.get(order.ticketName) || 0) + order.quantity,
    );
  }
  return counts;
}

function soldTicketsConflict(state, activityId, updatedActivity) {
  const sold = confirmedOrders(state, activityId);
  const totalSold = sold.reduce((total, order) => total + order.quantity, 0);
  if (totalSold > updatedActivity.ticketCapacity) {
    return "Kapasiteten kan ikke settes lavere enn antall solgte billetter";
  }

  for (const [name, soldCount] of soldTicketCounts(sold)) {
    const ticketType = updatedActivity.ticketTypes.find(
      (item) => item.name === name,
    );
    if (!ticketType || ticketType.quantity < soldCount) {
      return `Billetten «${name}» har solgte billetter og kan ikke fjernes eller få lavere antall enn ${soldCount}`;
    }
  }
  return "";
}

async function saveValidatedActivityImage(uploadedFile) {
  const matchedImageSignature = supportedImageSignatures.find((signature) =>
    signature.matches(uploadedFile.buffer),
  );
  if (!matchedImageSignature)
    return { error: "Last opp et gyldig PNG-, JPEG- eller WebP-bilde" };
  const imageStorageName = `${randomUUID()}${matchedImageSignature.extension}`;
  const contentType =
    matchedImageSignature.extension === ".png"
      ? "image/png"
      : matchedImageSignature.extension === ".webp"
        ? "image/webp"
        : "image/jpeg";
  await saveUpload(
    path.join("activity-images", imageStorageName),
    uploadedFile.buffer,
    contentType,
  );
  return {
    imageStorageName,
    imageUrl: `/api/activities/images/${imageStorageName}`,
  };
}

async function saveRequestImage(req, res) {
  if (!req.file) return null;
  const image = await saveValidatedActivityImage(req.file);
  if (image.error) {
    res.status(400).json({ message: image.error });
    return null;
  }
  return image;
}

async function removeActivityImage(imageStorageName) {
  if (!imageStorageName) return;
  await deleteUpload(path.join("activity-images", imageStorageName));
}

function getActivityId(req, res) {
  const activityId = Number(req.params.id);
  if (Number.isSafeInteger(activityId) && activityId > 0) return activityId;
  res.status(400).json({ message: "Aktivitets-ID-en er ugyldig" });
  return null;
}

function createActivityRecord(state, req, activityData, uploadedImage) {
  const activity = {
    id:
      Math.max(
        0,
        ...state.activities.map((storedActivity) => storedActivity.id),
      ) + 1,
    status: "published",
    ...activityData,
    ...(uploadedImage && {
      imageStorageName: uploadedImage.imageStorageName,
      imageUrl: uploadedImage.imageUrl,
    }),
    createdAt: new Date().toISOString(),
  };
  if (shouldArchive(activity)) activity.status = "archived";
  state.activities.push(activity);
  recordAudit(state, req, "activity.create", {
    activityId: activity.id,
    title: activity.title,
  });
  return { activity };
}

function updateActivityRecord(
  state,
  req,
  activityId,
  activityData,
  uploadedImage,
) {
  const activityIndex = state.activities.findIndex(
    (storedActivity) => storedActivity.id === activityId,
  );
  if (activityIndex === -1) return null;

  const currentActivity = state.activities[activityIndex];
  const updatedActivity = {
    ...currentActivity,
    ...activityData,
    ...(uploadedImage && {
      imageStorageName: uploadedImage.imageStorageName,
      imageUrl: uploadedImage.imageUrl,
    }),
    updatedAt: new Date().toISOString(),
  };
  if (shouldArchive(updatedActivity)) updatedActivity.status = "archived";
  const conflict = soldTicketsConflict(state, activityId, updatedActivity);
  if (conflict) return { conflict };

  state.activities[activityIndex] = updatedActivity;
  recordAudit(state, req, "activity.update", {
    activityId,
    title: updatedActivity.title,
    status: updatedActivity.status,
  });
  return {
    activity: updatedActivity,
    previousImageStorageName: uploadedImage
      ? currentActivity.imageStorageName
      : "",
  };
}

async function saveActivity(req, res, next, activityId = null) {
  let uploadedImage;
  try {
    const activityData = readActivityData(req, res, {
      allowEmptyTicketTypes: Boolean(activityId),
    });
    if (!activityData) return;

    uploadedImage = await saveRequestImage(req, res);
    if (req.file && !uploadedImage) return;

    const result = await updateStore((state) =>
      activityId
        ? updateActivityRecord(
            state,
            req,
            activityId,
            activityData,
            uploadedImage,
          )
        : createActivityRecord(state, req, activityData, uploadedImage),
    );
    if (!result || result.conflict) {
      await removeActivityImage(uploadedImage?.imageStorageName);
      uploadedImage = null;
      if (!result)
        return res.status(404).json({ message: "Aktiviteten ble ikke funnet" });
      return res.status(409).json({ message: result.conflict });
    }

    uploadedImage = null;
    await removeActivityImage(result.previousImageStorageName);
    res.status(activityId ? 200 : 201).json(toPublicActivity(result.activity));
  } catch (error) {
    await removeActivityImage(uploadedImage?.imageStorageName);
    next(error);
  }
}

router.get("/", (req, res) => {
  const visibleActivities =
    req.query.scope === "all" && adminSession(req)
      ? readStore().activities
      : readStore().activities.filter(isPublished);
  res.json(visibleActivities.map(toPublicActivity));
});

router.post("/", requireAdmin, parseActivityImage, (req, res, next) =>
  saveActivity(req, res, next),
);

router.put("/:id", requireAdmin, parseActivityImage, (req, res, next) => {
  const activityId = getActivityId(req, res);
  if (activityId) return saveActivity(req, res, next, activityId);
});

router.get("/images/:name", async (req, res, next) => {
  const imageFileName = req.params.name;
  if (!/^[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(imageFileName)) {
    return res.status(404).json({ message: "Bildet ble ikke funnet" });
  }
  const activityWithImage = readStore().activities.find(
    (storedActivity) => storedActivity.imageStorageName === imageFileName,
  );
  if (!activityWithImage || (!isPublished(activityWithImage) && !adminSession(req)))
    return res.status(404).json({ message: "Bildet ble ikke funnet" });
  const imageContentType = imageFileName.endsWith(".png")
    ? "image/png"
    : imageFileName.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  try {
    const image = await readUpload(path.join("activity-images", imageFileName));
    if (!image)
      return res.status(404).json({ message: "Bildet ble ikke funnet" });
    res.setHeader("Content-Type", imageContentType);
    res.setHeader("Cache-Control", "private, no-cache");
    res.end(image);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/orders", requireAdmin, (req, res) => {
  const activityId = getActivityId(req, res);
  if (!activityId) return;
  const state = readStore();
  const participants = state.orders
    .filter((order) => order.activityId === activityId)
    .map((order) => {
      const member = state.members.find((item) => item.id === order.memberId);
      return {
        ...order,
        memberName: member ? memberName(member) : "",
        memberEmail: member ? memberEmail(member) : "",
      };
    });
  res.json(participants);
});

router.get("/:id", (req, res) => {
  const activityId = Number(req.params.id);
  const requestedActivity = readStore().activities.find(
    (storedActivity) => storedActivity.id === activityId,
  );

  if (
    !requestedActivity ||
    (!isPublished(requestedActivity) && !adminSession(req))
  ) {
    return res.status(404).json({ message: "Aktiviteten ble ikke funnet" });
  }

  res.json(toPublicActivity(requestedActivity));
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const activityId = getActivityId(req, res);
    if (!activityId) return;
    const archived = await updateStore((applicationState) => {
      const activity = applicationState.activities.find(
        (storedActivity) => storedActivity.id === activityId,
      );
      if (!activity) return false;
      activity.status = "archived";
      activity.updatedAt = new Date().toISOString();
      confirmedOrders(applicationState, activityId).forEach((order) => {
        order.status = "cancelled";
        order.cancelledAt = activity.updatedAt;
      });
      recordAudit(applicationState, req, "activity.archive", {
        activityId,
        title: activity.title,
      });
      return true;
    });
    if (!archived)
      return res.status(404).json({ message: "Aktiviteten ble ikke funnet" });
    res.json({ message: "Aktiviteten er arkivert" });
  } catch (requestError) {
    next(requestError);
  }
});

export default router;
