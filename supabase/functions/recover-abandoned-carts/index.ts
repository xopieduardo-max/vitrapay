import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_NAME = "VitraPay";
const SENDER_DOMAIN = "notify.vitrapay.com.br";
const FROM_DOMAIN = "vitrapay.com.br";
const LOGO_URL = "https://taqseqektbipquvgfylc.supabase.co/storage/v1/object/public/email-assets/logo-vitrapay.png";

// Recovery window: payments older than 30min but younger than 23h (they expire at 24h)
const MIN_AGE_MINUTES = 30;
const MAX_AGE_HOURS = 23;

function buildRecoveryEmailHtml(buyerName: string, productTitle: string, checkoutLink: string): string {
  const name = buyerName || "Cliente";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        
        <!-- Logo -->
        <tr><td style="padding:28px 30px 0;text-align:left;">
          <img src="${LOGO_URL}" alt="VitraPay" width="140" height="40" style="display:block;" />
        </td></tr>

        <!-- Header -->
        <tr><td style="background:#f5c518;padding:32px 30px;text-align:center;">
          <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;font-weight:bold;">&#128722; Seu pedido está esperando!</h1>
          <p style="margin:0;color:#333;font-size:15px;">Notamos que você não finalizou seu pagamento</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.6;">
            Olá <strong>${name}</strong>,
          </p>
          <p style="font-size:16px;color:#333;margin:0 0 16px;line-height:1.6;">
            Percebemos que você iniciou a compra do produto abaixo, mas o pagamento ainda não foi confirmado:
          </p>

          <!-- Product Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:16px 20px;">
              <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Produto</p>
              <p style="font-size:18px;color:#0a0a0a;margin:0;font-weight:bold;">${productTitle}</p>
            </td></tr>
          </table>

          <p style="font-size:16px;color:#333;margin:0 0 24px;line-height:1.6;">
            Se você ainda deseja adquirir, clique no botão abaixo para finalizar sua compra. O link expira em breve!
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${checkoutLink}" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:bold;font-size:16px;padding:16px 36px;border-radius:12px;text-decoration:none;">
              Finalizar Minha Compra
            </a>
          </td></tr></table>

          <p style="font-size:14px;color:#666;margin:28px 0 0;line-height:1.5;">
            Se você já realizou o pagamento, desconsidere este e-mail. A confirmação pode levar alguns minutos.
          </p>
          <p style="font-size:14px;color:#666;margin:12px 0 0;line-height:1.5;">
            Qualquer dúvida, responda este e-mail.
          </p>
        </td></tr>

        <!-- Footer -->
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

function buildPlainText(buyerName: string, productTitle: string, checkoutLink: string): string {
  const name = buyerName || "Cliente";
  return `Olá ${name},\n\nPercebemos que você iniciou a compra do produto "${productTitle}", mas o pagamento ainda não foi confirmado.\n\nFinalize sua compra: ${checkoutLink}\n\nSe já realizou o pagamento, desconsidere este e-mail.\n\nEquipe VitraPay`;
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const minAge = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000).toISOString();
    const maxAge = new Date(now.getTime() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

    // Find pending payments that haven't been notified yet
    const { data: abandonedCarts, error: fetchError } = await supabase
      .from("pending_payments")
      .select("id, buyer_name, buyer_email, product_id, amount, created_at")
      .eq("status", "pending")
      .is("recovery_notified_at", null)
      .lt("created_at", minAge)
      .gt("created_at", maxAge)
      .not("buyer_email", "is", null)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching abandoned carts:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!abandonedCarts || abandonedCarts.length === 0) {
      console.log("No abandoned carts to recover");
      return new Response(JSON.stringify({ recovered: 0 }), { status: 200 });
    }

    console.log(`Found ${abandonedCarts.length} abandoned carts to recover`);

    // Get product titles
    const productIds = [...new Set(abandonedCarts.map(c => c.product_id))];
    const { data: products } = await supabase
      .from("products")
      .select("id, title")
      .in("id", productIds);

    const productMap = new Map((products || []).map(p => [p.id, p.title]));

    let sentCount = 0;

    for (const cart of abandonedCarts) {
      const productTitle = productMap.get(cart.product_id) || "Produto";
      const checkoutLink = `https://vitrapay.lovable.app/checkout/${cart.product_id}`;
      const buyerEmail = cart.buyer_email!;

      try {
        // Check suppression
        const { data: suppressed } = await supabase
          .from("suppressed_emails")
          .select("id")
          .eq("email", buyerEmail)
          .maybeSingle();

        if (suppressed) {
          console.log(`Skipping suppressed email: ${buyerEmail}`);
          // Mark as notified to avoid retrying
          await supabase.from("pending_payments").update({ recovery_notified_at: now.toISOString() }).eq("id", cart.id);
          continue;
        }

        // Get or create unsubscribe token
        const { data: existingToken } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", buyerEmail)
          .maybeSingle();

        let unsubscribeToken: string;
        if (existingToken?.token) {
          unsubscribeToken = existingToken.token;
        } else {
          unsubscribeToken = crypto.randomUUID();
          await supabase.from("email_unsubscribe_tokens").insert({
            email: buyerEmail,
            token: unsubscribeToken,
          });
        }

        const html = buildRecoveryEmailHtml(cart.buyer_name || "", productTitle, checkoutLink);
        const text = buildPlainText(cart.buyer_name || "", productTitle, checkoutLink);
        const messageId = crypto.randomUUID();

        // Log pending
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "cart_recovery",
          recipient_email: buyerEmail,
          status: "pending",
        });

        // Enqueue email
        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            idempotency_key: `cart-recovery-${cart.id}`,
            unsubscribe_token: unsubscribeToken,
            to: buyerEmail,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: `${cart.buyer_name || "Ei"}, sua compra está esperando! 🛒`,
            html,
            text,
            purpose: "transactional",
            label: "cart_recovery",
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          console.error(`Failed to enqueue recovery email for ${buyerEmail}:`, enqueueError);
          continue;
        }

        // Mark as notified
        await supabase.from("pending_payments").update({ recovery_notified_at: now.toISOString() }).eq("id", cart.id);

        // Also send push notification if buyer has an account
        try {
          const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("cpf", cart.buyer_email)
            .maybeSingle();

          // Try to find user by email
          const { data: userEmails } = await supabase.rpc("get_user_emails");
          const buyerUser = (userEmails || []).find((u: any) => u.email === buyerEmail);

          if (buyerUser) {
            const { data: subs } = await supabase
              .from("push_subscriptions")
              .select("endpoint, p256dh, auth")
              .eq("user_id", buyerUser.user_id);

            if (subs && subs.length > 0) {
              await supabase.functions.invoke("send-push", {
                body: {
                  subscriptions: subs,
                  title: "Sua compra está esperando! 🛒",
                  body: `Finalize a compra de "${productTitle}"`,
                  url: `/checkout/${cart.product_id}`,
                },
              });
            }
          }
        } catch (pushErr) {
          console.error("Push notification error (non-fatal):", pushErr);
        }

        sentCount++;
        console.log(`Recovery email sent to ${buyerEmail} for product ${productTitle}`);
      } catch (err) {
        console.error(`Error processing cart ${cart.id}:`, err);
      }
    }

    console.log(`Recovery complete: ${sentCount}/${abandonedCarts.length} emails sent`);
    return new Response(JSON.stringify({ recovered: sentCount, total: abandonedCarts.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Fatal error in recover-abandoned-carts:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
