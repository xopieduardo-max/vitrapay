import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Auto-creates a buyer account if one doesn't exist for the given email.
 * Returns { userId, tempPassword } if account was created, or { userId, tempPassword: null } if it already existed.
 */
export async function autoCreateBuyerAccount(
  supabase: ReturnType<typeof createClient>,
  buyerEmail: string,
  buyerName: string
): Promise<{ userId: string | null; tempPassword: string | null; isNew: boolean }> {
  try {
    // Check if user already exists by listing users with this email
    const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Search by email through the users list
    let existingUser = null;
    if (existingUsers?.users) {
      // listUsers doesn't support email filter well, so let's use a different approach
    }

    // Try to get user by email using a more reliable method
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", (
        await supabase.rpc("get_user_id_by_email", { _email: buyerEmail })
      ).data)
      .maybeSingle();

    // Simpler approach: try to create the user, if it fails with "already registered", the user exists
    const tempPassword = generateTempPassword();
    
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: buyerEmail,
      password: tempPassword,
      email_confirm: true, // Auto-confirm since they're buying
      user_metadata: {
        display_name: buyerName,
        auto_created: true,
      },
    });

    if (createErr) {
      // User already exists
      if (createErr.message?.includes("already been registered") || createErr.message?.includes("already exists")) {
        console.log("Buyer account already exists for:", buyerEmail);
        
        // Get existing user ID from profiles by looking up via product_access or other means
        const { data: existingProfile } = await supabase
          .from("product_access")
          .select("user_id")
          .eq("buyer_email", buyerEmail)
          .not("user_id", "is", null)
          .limit(1)
          .maybeSingle();

        return {
          userId: existingProfile?.user_id || null,
          tempPassword: null,
          isNew: false,
        };
      }
      
      console.error("Failed to create buyer account:", createErr.message);
      return { userId: null, tempPassword: null, isNew: false };
    }

    if (newUser?.user) {
      console.log("Auto-created buyer account:", newUser.user.id, buyerEmail);
      
      // Update product_access records for this email to link the user_id
      await supabase
        .from("product_access")
        .update({ user_id: newUser.user.id })
        .eq("buyer_email", buyerEmail)
        .is("user_id", null);

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

function generateTempPassword(): string {
  // Generate a readable temporary password: 3 words + 2 digits
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // Add special char and number to meet most password policies
  password += "!1";
  return password;
}
