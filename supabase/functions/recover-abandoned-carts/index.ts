import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_NAME = "VitraPay";
const SENDER_DOMAIN = "notify.vitrapay.com.br";
const FROM_DOMAIN = "vitrapay.com.br";
const LOGO_URL = "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/logo-vitrapay.png";

// First reminder: 30min–23h; Second reminder: 6h after first, still within 23h
const FIRST_MIN_AGE_MINUTES = 30;
const MAX_AGE_HOURS = 23;
const SECOND_REMINDER_DELAY_HOURS = 6;

function buildRecoveryEmailHtml(buyerName: string, productTitle: string, checkoutLink: string, isSecond: boolean): string {
  const name = buyerName || "Cliente";
  const headline = isSecond
    ? "⏰ Última chance! Seu pedido vai expirar"
    : "🛒 Seu pedido está esperando!";
  const subtitle = isSecond
    ? "O link de pagamento expira em breve"
    : "Notamos que você não finalizou seu pagamento";
  const bodyText = isSecond
    ? "Este é nosso último lembrete — o link de pagamento do produto abaixo expira em poucas horas:"
    : "Percebemos que você iniciou a compra do produto abaixo, mas o pagamento ainda não foi confirmado:";
  const ctaText = isSecond ? "Finalizar Agora (Última Chance)" : "Finalizar Minha Compra";
  const headerBg = isSecond ? "#e74c3c" : "#f5c518";
  const headerTextColor = isSecond ? "#ffffff" : "#1a1a1a";
  const ctaBg = isSecond ? "#e74c3c" : "#f5c518";
  const ctaColor = isSecond ? "#ffffff" : "#1a1a1a";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 30px 0;text-align:left;">
          <img src="${LOGO_URL}" alt="VitraPay" width="140" height="40" style="display:block;" />
        </td></tr>
        <tr><td style="background:${headerBg};padding:32px 30px;text-align:center;">
          <h1 style="margin:0 0 8px;color:${headerTextColor};font-size:24px;font-weight:bold;">${headline}</h1>
          <p style="margin:0;color:${headerTextColor};font-size:15px;opacity:0.9;">${subtitle}</p>
        </td></tr>
        <tr><td style="padding:30px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.6;">Olá <strong>${name}</strong>,</p>
          <p style="font-size:16px;color:#333;margin:0 0 16px;line-height:1.6;">${bodyText}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:16px 20px;">
              <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Produto</p>
              <p style="font-size:18px;color:#0a0a0a;margin:0;font-weight:bold;">${productTitle}</p>
            </td></tr>
          </table>
          <p style="font-size:16px;color:#333;margin:0 0 24px;line-height:1.6;">
            ${isSecond ? "Não perca esta oportunidade! Clique abaixo antes que o link expire:" : "Se você ainda deseja adquirir, clique no botão abaixo para finalizar sua compra. O link expira em breve!"}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${checkoutLink}" style="display:inline-block;background:${ctaBg};color:${ctaColor};font-weight:bold;font-size:16px;padding:16px 36px;border-radius:12px;text-decoration:none;">${ctaText}</a>
          </td></tr></table>
          <p style="font-size:14px;color:#666;margin:28px 0 0;line-height:1.5;">Se você já realizou o pagamento, desconsidere este e-mail.</p>
          <p style="font-size:14px;color:#666;margin:12px 0 0;line-height:1.5;">Qualquer dúvida, responda este e-mail.</p>
        </td></tr>
        <tr><td style="background:#f5f5f5;padding:24px 30px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">Equipe VitraPay &middot; vitrapay.com.br</p>
          <p style="margin:8px 0 0;color:#bbb;font-size:11px;">Este e-mail foi enviado porque você iniciou uma compra em nossa plataforma.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPlainText(buyerName: string, productTitle: string, checkoutLink: string, isSecond: boolean): string {
  const name = buyerName || "Cliente";
  const prefix = isSecond ? "ÚLTIMA CHANCE! " : "";
  return `${prefix}Olá ${name},\n\nPercebemos que você iniciou a compra do produto "${productTitle}", mas o pagamento ainda não foi confirmado.\n\nFinalize sua compra: ${checkoutLink}\n\nSe já realizou o pagamento, desconsidere este e-mail.\n\nEquipe VitraPay`;
}

async function getOrCreateUnsubToken(supabase: any, email: string): Promise<string> {
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();
  if (existing?.token) return existing.token;
  const token = crypto.randomUUID();
  await supabase.from("email_unsubscribe_tokens").insert({ email, token });
  return token;
}

async function isSuppressed(supabase: any, email: string): Promise<boolean> {
  const { data } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

async function sendRecoveryEmail(
  supabase: any,
  cart: any,
  productTitle: string,
  isSecond: boolean,
  now: Date,
): Promise<boolean> {
  const buyerEmail = cart.buyer_email!;
  const checkoutLink = `https://vitrapay.lovable.app/checkout/${cart.product_id}`;

  if (await isSuppressed(supabase, buyerEmail)) {
    console.log(`Skipping suppressed email: ${buyerEmail}`);
    const updateCol = isSecond ? "recovery_second_notified_at" : "recovery_notified_at";
    await supabase.from("pending_payments").update({ [updateCol]: now.toISOString() }).eq("id", cart.id);
    return false;
  }

  const unsubscribeToken = await getOrCreateUnsubToken(supabase, buyerEmail);
  const html = buildRecoveryEmailHtml(cart.buyer_name || "", productTitle, checkoutLink, isSecond);
  const text = buildPlainText(cart.buyer_name || "", productTitle, checkoutLink, isSecond);
  const messageId = crypto.randomUUID();
  const label = isSecond ? "cart_recovery_2" : "cart_recovery";
  const templateName = isSecond ? "cart_recovery_2" : "cart_recovery";
  const idempotencyKey = isSecond ? `cart-recovery-2-${cart.id}` : `cart-recovery-${cart.id}`;
  const subjectEmoji = isSecond ? "⏰" : "🛒";
  const subjectText = isSecond
    ? `${cart.buyer_name || "Ei"}, última chance para sua compra! ${subjectEmoji}`
    : `${cart.buyer_name || "Ei"}, sua compra está esperando! ${subjectEmoji}`;

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: buyerEmail,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      to: buyerEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: subjectText,
      html,
      text,
      purpose: "transactional",
      label,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    console.error(`Failed to enqueue ${label} for ${buyerEmail}:`, enqueueError);
    return false;
  }

  const updateCol = isSecond ? "recovery_second_notified_at" : "recovery_notified_at";
  await supabase.from("pending_payments").update({ [updateCol]: now.toISOString() }).eq("id", cart.id);

  // Push notification (best-effort)
  try {
    const { data: userEmails } = await supabase.rpc("get_user_emails");
    const buyerUser = (userEmails || []).find((u: any) => u.email === buyerEmail);
    if (buyerUser) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", buyerUser.user_id);
      if (subs && subs.length > 0) {
        const pushTitle = isSecond ? "Última chance! ⏰" : "Sua compra está esperando! 🛒";
        await supabase.functions.invoke("send-push", {
          body: {
            subscriptions: subs,
            title: pushTitle,
            body: `Finalize a compra de "${productTitle}"`,
            url: `/checkout/${cart.product_id}`,
          },
        });
      }
    }
  } catch (pushErr) {
    console.error("Push notification error (non-fatal):", pushErr);
  }

  console.log(`${label} email sent to ${buyerEmail} for product ${productTitle}`);
  return true;
}

Deno.serve(async (_req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const firstMinAge = new Date(now.getTime() - FIRST_MIN_AGE_MINUTES * 60 * 1000).toISOString();
    const maxAge = new Date(now.getTime() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

    let firstSent = 0;
    let secondSent = 0;

    // === FIRST REMINDER: pending, not notified, 30min–23h old ===
    const { data: firstBatch, error: e1 } = await supabase
      .from("pending_payments")
      .select("id, buyer_name, buyer_email, product_id, amount, created_at")
      .eq("status", "pending")
      .is("recovery_notified_at", null)
      .lt("created_at", firstMinAge)
      .gt("created_at", maxAge)
      .not("buyer_email", "is", null)
      .limit(50);

    if (e1) {
      console.error("Error fetching first batch:", e1);
      return new Response(JSON.stringify({ error: e1.message }), { status: 500 });
    }

    // === SECOND REMINDER: notified 6h+ ago, still pending, within 23h, not yet second-notified ===
    const secondMinDelay = new Date(now.getTime() - SECOND_REMINDER_DELAY_HOURS * 60 * 60 * 1000).toISOString();
    const { data: secondBatch, error: e2 } = await supabase
      .from("pending_payments")
      .select("id, buyer_name, buyer_email, product_id, amount, created_at, recovery_notified_at")
      .eq("status", "pending")
      .not("recovery_notified_at", "is", null)
      .lt("recovery_notified_at", secondMinDelay)
      .is("recovery_second_notified_at", null)
      .gt("created_at", maxAge)
      .not("buyer_email", "is", null)
      .limit(50);

    if (e2) {
      console.error("Error fetching second batch:", e2);
      return new Response(JSON.stringify({ error: e2.message }), { status: 500 });
    }

    const allCarts = [
      ...((firstBatch || []).map(c => ({ ...c, isSecond: false }))),
      ...((secondBatch || []).map(c => ({ ...c, isSecond: true }))),
    ];

    if (allCarts.length === 0) {
      console.log("No abandoned carts to recover");
      return new Response(JSON.stringify({ first: 0, second: 0 }), { status: 200 });
    }

    // Get product titles
    const productIds = [...new Set(allCarts.map(c => c.product_id))];
    const { data: products } = await supabase
      .from("products")
      .select("id, title")
      .in("id", productIds);
    const productMap = new Map((products || []).map(p => [p.id, p.title]));

    console.log(`Found ${firstBatch?.length || 0} first reminders, ${secondBatch?.length || 0} second reminders`);

    for (const cart of allCarts) {
      const productTitle = productMap.get(cart.product_id) || "Produto";
      try {
        const sent = await sendRecoveryEmail(supabase, cart, productTitle, cart.isSecond, now);
        if (sent) {
          if (cart.isSecond) secondSent++;
          else firstSent++;
        }
      } catch (err) {
        console.error(`Error processing cart ${cart.id}:`, err);
      }
    }

    console.log(`Recovery complete: ${firstSent} first, ${secondSent} second reminders sent`);
    return new Response(JSON.stringify({ first: firstSent, second: secondSent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Fatal error in recover-abandoned-carts:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
