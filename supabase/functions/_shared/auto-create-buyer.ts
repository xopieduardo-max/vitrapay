import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CheckoutFieldsFlags {
  cpf?: boolean;
  phone?: boolean;
  [key: string]: unknown;
}

/**
 * Auto-creates a buyer account if one doesn't exist for the given email.
 *
 * Password priority (based on the checkout fields the producer left enabled):
 *   1. CPF enabled  → first 6 digits of the CPF
 *   2. Phone enabled → first 6 digits of the phone (after stripping non-digits and BR DDI 55)
 *   3. Neither     → random 6-digit numeric password (also returned so it can be emailed)
 *
 * Returns:
 *   - userId: the auth user id (existing or new)
 *   - tempPassword: a hint for the purchase email:
 *        "cpf"          → "use os 6 primeiros dígitos do seu CPF"
 *        "phone"        → "use os 6 primeiros dígitos do seu telefone"
 *        "<6-digits>"   → the actual random password to show the buyer
 *        null           → account already existed, no message to show
 *   - isNew: whether we just created the account
 */
export async function autoCreateBuyerAccount(
  supabase: ReturnType<typeof createClient>,
  buyerEmail: string,
  buyerName: string,
  buyerCpf: string | null = null,
  buyerPhone: string | null = null,
  checkoutFields: CheckoutFieldsFlags | null = null
): Promise<{ userId: string | null; tempPassword: string | null; isNew: boolean }> {
  try {
    // Default to legacy behaviour (both enabled) when the caller doesn't pass flags,
    // so any code path that hasn't been updated yet still keeps the CPF-first logic.
    const cpfEnabled = checkoutFields ? checkoutFields.cpf !== false : true;
    const phoneEnabled = checkoutFields ? checkoutFields.phone !== false : true;

    const { password, source } = buildInitialPassword({
      cpf: buyerCpf,
      phone: buyerPhone,
      cpfEnabled,
      phoneEnabled,
    });

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
      console.log("Auto-created buyer account:", newUser.user.id, buyerEmail, "(source:", source, ")");

      await supabase
        .from("product_access")
        .update({ user_id: newUser.user.id })
        .eq("buyer_email", buyerEmail)
        .is("user_id", null);

      await supabase
        .from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", newUser.user.id);

      // Signal for the purchase email:
      //   cpf   → hint text
      //   phone → hint text
      //   random → show the actual password
      const tempPassword =
        source === "cpf" ? "cpf" : source === "phone" ? "phone" : password;

      return {
        userId: newUser.user.id,
        tempPassword,
        isNew: true,
      };
    }

    return { userId: null, tempPassword: null, isNew: false };
  } catch (err) {
    console.error("autoCreateBuyerAccount error:", err);
    return { userId: null, tempPassword: null, isNew: false };
  }
}

interface BuildPasswordInput {
  cpf: string | null;
  phone: string | null;
  cpfEnabled: boolean;
  phoneEnabled: boolean;
}

function buildInitialPassword(input: BuildPasswordInput): {
  password: string;
  source: "cpf" | "phone" | "random";
} {
  // 1. CPF enabled and available
  if (input.cpfEnabled && input.cpf) {
    const digits = input.cpf.replace(/\D/g, "");
    if (digits.length >= 6) {
      return { password: digits.slice(0, 6), source: "cpf" };
    }
  }

  // 2. Phone enabled and available
  if (input.phoneEnabled && input.phone) {
    let digits = input.phone.replace(/\D/g, "");
    // Strip Brazilian DDI so the buyer types the number they know.
    if (digits.length > 11 && digits.startsWith("55")) {
      digits = digits.slice(2);
    }
    if (digits.length >= 6) {
      return { password: digits.slice(0, 6), source: "phone" };
    }
  }

  // 3. Random 6-digit numeric password
  const random = generateNumericPassword(6);
  return { password: random, source: "random" };
}

function generateNumericPassword(length: number): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += (arr[i] % 10).toString();
  return out;
}
