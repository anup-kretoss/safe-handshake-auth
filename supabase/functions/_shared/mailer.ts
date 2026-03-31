// Shared mailer using Resend HTTP API
// Called from all edge functions that need to send transactional emails.

const FROM_EMAIL = "Souk IT <info@souk-it.com>";

// Send email via Resend HTTP API (simpler & more reliable than raw SMTP in Deno)
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!apiKey) {
    console.warn("[mailer] RESEND_API_KEY not set — skipping email");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[mailer] Failed to send email:", res.status, body);
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Souk IT</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">SOUK IT</h1>
              <p style="margin:6px 0 0;color:#a0aec0;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Your Marketplace</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} Souk IT. All rights reserved.</p>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">
                <a href="mailto:info@souk-it.com" style="color:#6366f1;text-decoration:none;">info@souk-it.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;font-weight:700;">${text}</h2>`;
}

function subtext(text: string): string {
  return `<p style="margin:0 0 24px;color:#64748b;font-size:14px;">${text}</p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${text}</p>`;
}

function infoBox(rows: { label: string; value: string }[]): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;width:40%;border-bottom:1px solid #f1f5f9;">${r.label}</td>
          <td style="padding:10px 16px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;">${r.value}</td>
        </tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:0 0 24px;overflow:hidden;">
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

function otpBox(otp: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <div style="display:inline-block;background:#f0f4ff;border:2px dashed #6366f1;border-radius:12px;padding:20px 40px;">
      <p style="margin:0 0 4px;color:#6366f1;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Your OTP Code</p>
      <p style="margin:0;color:#1a1a2e;font-size:36px;font-weight:800;letter-spacing:12px;">${otp}</p>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">Valid for 10 minutes</p>
    </div>
  </div>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
}

// ─── Specific Templates ───────────────────────────────────────────────────────

export function welcomeEmail(firstName: string, email: string): string {
  return baseTemplate(`
    ${heading("Welcome to Souk IT! 🎉")}
    ${subtext("Your account has been created successfully.")}
    ${paragraph(`Hi <strong>${firstName}</strong>, we're thrilled to have you on board. Souk IT is your go-to marketplace for buying and selling quality items.`)}
    ${infoBox([
      { label: "Name", value: firstName },
      { label: "Email", value: email },
      { label: "Account Status", value: "Active ✓" },
    ])}
    ${paragraph("You can now browse thousands of listings, sell your own items, and connect with buyers and sellers in your community.")}
    ${paragraph("If you have any questions, our support team is always here to help at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
    ${divider()}
    ${paragraph("<em>Happy shopping and selling!</em>")}
  `);
}

export function otpEmail(firstName: string, otp: string): string {
  return baseTemplate(`
    ${heading("Password Reset Request")}
    ${subtext("We received a request to reset your password.")}
    ${paragraph(`Hi <strong>${firstName || "there"}</strong>, use the OTP below to reset your password. This code is valid for <strong>10 minutes</strong>.`)}
    ${otpBox(otp)}
    ${paragraph("If you did not request a password reset, please ignore this email or contact us immediately at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
    ${divider()}
    ${paragraph("<small style='color:#94a3b8;'>For security, never share this code with anyone.</small>")}
  `);
}

export function passwordChangedEmail(firstName: string): string {
  return baseTemplate(`
    ${heading("Password Changed Successfully")}
    ${subtext("Your account password has been updated.")}
    ${paragraph(`Hi <strong>${firstName || "there"}</strong>, your Souk IT account password was changed successfully.`)}
    ${infoBox([
      { label: "Action", value: "Password Changed" },
      { label: "Time", value: new Date().toUTCString() },
      { label: "Status", value: "Successful ✓" },
    ])}
    ${paragraph("If you did not make this change, please contact us immediately at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a> to secure your account.")}
  `);
}

export function productListedEmail(
  sellerName: string,
  productTitle: string,
  price: number,
  productId: string
): string {
  return baseTemplate(`
    ${heading("Your Item is Now Live! 🛍️")}
    ${subtext("Your product has been successfully listed on Souk IT.")}
    ${paragraph(`Hi <strong>${sellerName}</strong>, great news — your item is now visible to thousands of buyers on Souk IT.`)}
    ${infoBox([
      { label: "Product", value: productTitle },
      { label: "Listed Price", value: `AED ${price.toFixed(2)}` },
      { label: "Product ID", value: productId },
      { label: "Status", value: "Live ✓" },
    ])}
    ${paragraph("Buyers can now discover and purchase your item. You'll receive a notification as soon as someone places an order.")}
    ${paragraph("Tip: Make sure your pickup address is up to date in your profile settings for a smooth handover.")}
  `);
}

export function orderPlacedBuyerEmail(
  buyerName: string,
  productTitle: string,
  itemPrice: number,
  deliveryPrice: number,
  totalPrice: number,
  deliveryType: string,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("Order Placed Successfully! 📦")}
    ${subtext("Thank you for your purchase on Souk IT.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, your order has been placed and the seller has been notified.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Item Price", value: `AED ${itemPrice.toFixed(2)}` },
      { label: "Delivery", value: `AED ${deliveryPrice.toFixed(2)} (${deliveryType === "24hour" ? "24-Hour Express" : "Standard"})` },
      { label: "Total", value: `AED ${totalPrice.toFixed(2)}` },
      { label: "Status", value: deliveryType === "24hour" ? "Awaiting Seller Approval" : "Confirmed ✓" },
    ])}
    ${paragraph(
      deliveryType === "24hour"
        ? "The seller has <strong>1 hour</strong> to approve your 24-hour delivery request. If not approved in time, it will automatically switch to standard delivery."
        : "Your order is confirmed. The seller will prepare your item for pickup and delivery."
    )}
    ${paragraph("You can track your order status in the Orders section of the app.")}
  `);
}

export function orderReceivedSellerEmail(
  sellerName: string,
  productTitle: string,
  itemPrice: number,
  deliveryPrice: number,
  totalPrice: number,
  deliveryType: string,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("You Have a New Order! 🎉")}
    ${subtext("A buyer has purchased your item on Souk IT.")}
    ${paragraph(`Hi <strong>${sellerName}</strong>, congratulations — your item has been sold!`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item Sold", value: productTitle },
      { label: "Item Price", value: `AED ${itemPrice.toFixed(2)}` },
      { label: "Delivery Fee", value: `AED ${deliveryPrice.toFixed(2)}` },
      { label: "Total", value: `AED ${totalPrice.toFixed(2)}` },
      { label: "Delivery Type", value: deliveryType === "24hour" ? "24-Hour Express" : "Standard" },
    ])}
    ${
      deliveryType === "24hour"
        ? paragraph("⚡ This is a <strong>24-hour delivery request</strong>. Please approve or reject it within <strong>1 hour</strong> from the Orders section in the app.")
        : paragraph("Please prepare your item for pickup. Mark it as ready in the Orders section once it's packed.")
    }
  `);
}

export function deliveryRequestEmail(
  sellerName: string,
  productTitle: string,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("24-Hour Delivery Request ⚡")}
    ${subtext("A buyer wants express delivery for your item.")}
    ${paragraph(`Hi <strong>${sellerName}</strong>, a buyer has requested <strong>24-hour express delivery</strong> for your listing.`)}
    ${infoBox([
      { label: "Product", value: productTitle },
      { label: "Order ID", value: orderId },
      { label: "Delivery Type", value: "24-Hour Express" },
      { label: "Action Required", value: "Approve or Reject within 1 hour" },
    ])}
    ${paragraph("Open the app and go to <strong>Orders</strong> to approve or reject this request. If no action is taken within 1 hour, the order will automatically switch to standard delivery.")}
  `);
}

export function orderShippedEmail(
  buyerName: string,
  productTitle: string,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("Your Order is On Its Way! 🚚")}
    ${subtext("Your item has been shipped and is heading to you.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, great news — your order has been picked up and is now on its way to you.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Status", value: "Shipped 🚚" },
    ])}
    ${paragraph("You can track your delivery status in the Orders section of the app. Please ensure someone is available to receive the package.")}
    ${paragraph("If you have any issues with your delivery, contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}

export function orderDeliveredEmail(
  buyerName: string,
  productTitle: string,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("Order Delivered Successfully! ✅")}
    ${subtext("Your item has been delivered.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, your order has been marked as delivered. We hope you love your new item!`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Status", value: "Delivered ✅" },
    ])}
    ${paragraph("If you have any concerns about your order, please reach out to us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
    ${divider()}
    ${paragraph("Thank you for shopping on Souk IT. We hope to see you again soon!")}
  `);
}

export function orderCancelledEmail(
  recipientName: string,
  productTitle: string,
  orderId: string,
  isBuyer: boolean
): string {
  return baseTemplate(`
    ${heading("Order Cancelled")}
    ${subtext("An order has been cancelled.")}
    ${paragraph(`Hi <strong>${recipientName}</strong>, the following order has been cancelled.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Status", value: "Cancelled" },
      { label: "Role", value: isBuyer ? "Buyer" : "Seller" },
    ])}
    ${
      isBuyer
        ? paragraph("If you did not cancel this order or have any concerns, please contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")
        : paragraph("The item has been unlisted and is available for sale again. You can relist it from your seller dashboard.")
    }
  `);
}

export function deliveryApprovedBuyerEmail(
  buyerName: string,
  productTitle: string,
  orderId: string,
  sellerNotes?: string
): string {
  return baseTemplate(`
    ${heading("24-Hour Delivery Approved! ⚡✅")}
    ${subtext("Great news — the seller has approved your express delivery request.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, the seller has approved your <strong>24-hour express delivery</strong> request. You can now proceed with payment to confirm your order.`)}
    ${infoBox([
      { label: "Product", value: productTitle },
      { label: "Order ID", value: orderId },
      { label: "Delivery Type", value: "24-Hour Express ⚡" },
      { label: "Status", value: "Approved ✓ — Awaiting Payment" },
      ...(sellerNotes ? [{ label: "Seller Note", value: sellerNotes }] : []),
    ])}
    ${paragraph("Please open the app and complete your payment to lock in the 24-hour delivery. Your item will be dispatched as soon as payment is confirmed.")}
    ${paragraph("If you have any questions, contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}

export function deliveryRejectedBuyerEmail(
  buyerName: string,
  productTitle: string,
  orderId: string,
  sellerNotes?: string
): string {
  return baseTemplate(`
    ${heading("24-Hour Delivery Unavailable")}
    ${subtext("The seller is unable to fulfil the express delivery request.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, unfortunately the seller cannot provide <strong>24-hour express delivery</strong> for this order at this time.`)}
    ${infoBox([
      { label: "Product", value: productTitle },
      { label: "Order ID", value: orderId },
      { label: "Delivery Type", value: "Switched to Standard Delivery" },
      { label: "New Delivery Fee", value: "AED 20.00" },
      { label: "Status", value: "Pending Payment" },
      ...(sellerNotes ? [{ label: "Seller Note", value: sellerNotes }] : []),
    ])}
    ${paragraph("Your order has been automatically switched to <strong>standard delivery (AED 20)</strong>. You can still proceed with payment and receive your item within the standard timeframe.")}
    ${paragraph("Open the app and go to <strong>Orders</strong> to complete your payment.")}
    ${paragraph("If you have any concerns, contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}

export function deliveryExpiredBuyerEmail(
  buyerName: string,
  productTitle: string,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("24-Hour Delivery Request Expired")}
    ${subtext("The seller did not respond in time — your order has been updated.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, the seller did not respond to your 24-hour delivery request within the 1-hour window.`)}
    ${infoBox([
      { label: "Product", value: productTitle },
      { label: "Order ID", value: orderId },
      { label: "Delivery Type", value: "Switched to Standard Delivery" },
      { label: "New Delivery Fee", value: "AED 20.00" },
      { label: "Status", value: "Pending Payment" },
    ])}
    ${paragraph("Your order has been automatically switched to <strong>standard delivery (AED 20)</strong>. You can proceed with payment at any time.")}
    ${paragraph("Open the app and go to <strong>Orders</strong> to complete your payment.")}
    ${paragraph("If you have any questions, contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}

export function paymentReceivedSellerEmail(
  sellerName: string,
  productTitle: string,
  itemPrice: number,
  deliveryPrice: number,
  totalPrice: number,
  orderId: string
): string {
  return baseTemplate(`
    ${heading("Payment Confirmed! 💰")}
    ${subtext("Payment has been received for your item.")}
    ${paragraph(`Hi <strong>${sellerName}</strong>, payment has been confirmed for your sold item.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Item Price", value: `AED ${itemPrice.toFixed(2)}` },
      { label: "Delivery Fee", value: `AED ${deliveryPrice.toFixed(2)}` },
      { label: "Total", value: `AED ${totalPrice.toFixed(2)}` },
      { label: "Payment Status", value: "Confirmed ✓" },
    ])}
    ${paragraph("Please prepare your item for pickup. Mark it as ready in the Orders section once it's packed and ready for the courier.")}
  `);
}

export function paymentSuccessBuyerEmail(
  buyerName: string,
  productTitle: string,
  itemPrice: number,
  deliveryPrice: number,
  totalPrice: number,
  deliveryType: string,
  orderId: string,
  transactionId?: string
): string {
  return baseTemplate(`
    ${heading("Payment Successful! 🎉")}
    ${subtext("Your payment has been confirmed and your order is now active.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, we've received your payment. Your order is confirmed and the seller has been notified to prepare your item.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Item Price", value: `AED ${itemPrice.toFixed(2)}` },
      { label: "Delivery", value: `AED ${deliveryPrice.toFixed(2)} (${deliveryType === "24hour" ? "24-Hour Express" : "Standard"})` },
      { label: "Total Paid", value: `AED ${totalPrice.toFixed(2)}` },
      { label: "Payment Status", value: "✅ Paid" },
      ...(transactionId ? [{ label: "Transaction ID", value: transactionId }] : []),
    ])}
    ${paragraph(
      deliveryType === "24hour"
        ? "Your item will be dispatched within <strong>24 hours</strong>. You'll receive another email once it's on its way."
        : "Your item will be dispatched within <strong>3–5 business days</strong>. You'll receive another email once it's shipped."
    )}
    ${paragraph("You can track your order status anytime in the <strong>Orders</strong> section of the app.")}
    ${divider()}
    ${paragraph("Thank you for shopping on Souk IT! If you have any questions, contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}

export function paymentReceivedSellerFullEmail(
  sellerName: string,
  productTitle: string,
  itemPrice: number,
  deliveryPrice: number,
  totalPrice: number,
  deliveryType: string,
  orderId: string,
  transactionId?: string
): string {
  return baseTemplate(`
    ${heading("Payment Received for Your Item! 💰")}
    ${subtext("A buyer has successfully paid for your listing.")}
    ${paragraph(`Hi <strong>${sellerName}</strong>, great news — payment has been confirmed for your item. Please prepare it for pickup.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item Sold", value: productTitle },
      { label: "Item Price", value: `AED ${itemPrice.toFixed(2)}` },
      { label: "Delivery Fee", value: `AED ${deliveryPrice.toFixed(2)} (${deliveryType === "24hour" ? "24-Hour Express" : "Standard"})` },
      { label: "Total", value: `AED ${totalPrice.toFixed(2)}` },
      { label: "Payment Status", value: "✅ Confirmed" },
      ...(transactionId ? [{ label: "Transaction ID", value: transactionId }] : []),
    ])}
    ${paragraph("Please pack your item and mark it as <strong>Ready for Pickup</strong> in the Orders section of the app so the courier can collect it.")}
    ${paragraph(
      deliveryType === "24hour"
        ? "⚡ This is a <strong>24-hour express order</strong> — please prioritise packing and marking it ready as soon as possible."
        : "Standard delivery — please have the item ready within 1–2 business days."
    )}
    ${divider()}
    ${paragraph("If you have any questions, contact us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}

export function paymentFailedBuyerEmail(
  buyerName: string,
  productTitle: string,
  totalPrice: number,
  orderId: string,
  reason?: string
): string {
  return baseTemplate(`
    ${heading("Payment Failed ❌")}
    ${subtext("Unfortunately your payment could not be processed.")}
    ${paragraph(`Hi <strong>${buyerName}</strong>, we were unable to process your payment for the following order.`)}
    ${infoBox([
      { label: "Order ID", value: orderId },
      { label: "Item", value: productTitle },
      { label: "Amount", value: `AED ${totalPrice.toFixed(2)}` },
      { label: "Payment Status", value: "❌ Failed" },
      ...(reason ? [{ label: "Reason", value: reason }] : []),
    ])}
    ${paragraph("Your order has <strong>not been confirmed</strong> and you have <strong>not been charged</strong>. The item is still available.")}
    ${paragraph("You can try again by going to <strong>Orders</strong> in the app and retrying the payment, or contact us if the issue persists.")}
    ${divider()}
    ${paragraph("Need help? Reach us at <a href='mailto:info@souk-it.com' style='color:#6366f1;'>info@souk-it.com</a>.")}
  `);
}
