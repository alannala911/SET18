import nodemailer from "nodemailer";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export function frontendLink(pathAndQuery) {
  return `${(process.env.PUBLIC_FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")}${pathAndQuery}`;
}

function sendMail({ to, subject, text, html }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE } = process.env;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true" || (!SMTP_SECURE && Number(SMTP_PORT) === 465),
    ...(SMTP_USER && SMTP_PASS ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {})
  });
  return transport.sendMail({ from: SMTP_FROM, to, subject, text, html });
}

export function sendLinkMail(to, { subject, intro, linkText, link, outro }) {
  return sendMail({
    to,
    subject,
    text: `${intro}: ${link}\n\n${outro}`,
    html: `<p>${intro}:</p><p><a href="${link}">${linkText}</a></p><p>${outro}</p>`
  });
}
