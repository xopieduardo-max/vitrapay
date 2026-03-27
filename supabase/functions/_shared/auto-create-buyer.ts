import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Auto-creates a buyer account if one doesn't exist for the given email.
 * Uses the first 6 digits of the buyer's CPF as the password.
 * Returns { userId, isNew } — if isNew, the password is the CPF-based one.
 */
export async function autoCreateBuyerAccount(
  supabase: ReturnType<typeof createClient>,
  buyerEmail: string,
  buyerName: string,
  buyerCpf: string | null = null
): Promise<{ userId: string | null; tempPassword: string | null; isNew: boolean }> {
  try {
    // Build password from CPF (first 6 digits) or fallback to random
    const password = buildCpfPassword(buyerCpf);

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: buyerEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: buyerName,
        auto_created: true,
      },
    });

    if (createErr) {
      if (
        createErr.message?.includes("already been registered") ||
        createErr.message?.includes("already exists")
      ) {
        console.log("Buyer account already exists for:", buyerEmail);

        // Try to find existing user_id from product_access
        const { data: existingAccess } = await supabase
          .from("product_access")
          .select("user_id")
          .eq("buyer_email", buyerEmail)
          .not("user_id", "is", null)
          .limit(1)
          .maybeSingle();

        return {
          userId: existingAccess?.user_id || null,
          tempPassword: null,
          isNew: false,
        };
      }

      console.error("Failed to create buyer account:", createErr.message);
      return { userId: null, tempPassword: null, isNew: false };
    }

    if (newUser?.user) {
      console.log("Auto-created buyer account:", newUser.user.id, buyerEmail);

      // Link all existing product_access rows for this email
      await supabase
        .from("product_access")
        .update({ user_id: newUser.user.id })
        .eq("buyer_email", buyerEmail)
        .is("user_id", null);

      return {
        userId: newUser.user.id,
        tempPassword: buyerCpf ? "cpf" : password, // signal that password is CPF-based
        isNew: true,
      };
    }

    return { userId: null, tempPassword: null, isNew: false };
  } catch (err) {
    console.error("autoCreateBuyerAccount error:", err);
    return { userId: null, tempPassword: null, isNew: false };
  }
}

/**
 * Extracts the first 6 digits from a CPF string to use as password.
 * If CPF is null/empty or has fewer than 6 digits, generates a random password.
 */
function buildCpfPassword(cpf: string | null): string {
  if (cpf) {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length >= 6) {
      return digits.slice(0, 6);
    }
  }
  // Fallback: random password if no CPF
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  password += "!1";
  return password;
}
