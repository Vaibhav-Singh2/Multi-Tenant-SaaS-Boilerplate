import type { Job } from "bullmq";
import { createLogger } from "@saas/logger";
import type { EmailJobPayload } from "@saas/types";

const logger = createLogger("email-processor");

/**
 * Email processor stub — plug in your email provider here.
 * Supports: Resend, SendGrid, Nodemailer, AWS SES, etc.
 */
export async function emailProcessor(job: Job<EmailJobPayload>): Promise<void> {
  const { to, subject, html, _text, tenantId } = job.data;

  logger.info("Processing email job", { to, subject, tenantId });

  // ── Example: Resend ──────────────────────────────────────────────────────────
  // const { Resend } = await import("resend");
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from: "noreply@yourdomain.com", to, subject, html });

  // ── Example: Nodemailer ──────────────────────────────────────────────────────
  // const nodemailer = await import("nodemailer");
  // const transporter = nodemailer.createTransport({ host: ..., port: ..., auth: {...} });
  // await transporter.sendMail({ from: "...", to, subject, html, text });

  // ── Placeholder (log only in dev) ────────────────────────────────────────────
  if (process.env["NODE_ENV"] !== "production") {
    logger.info("[DEV] Email would be sent", {
      to,
      subject,
      html: html.slice(0, 100),
    });
    return;
  }

  throw new Error(
    "Email provider not configured. Set up your provider in emailProcessor.ts",
  );
}
