import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Master, MasterResponse, Organization } from "@/lib/types";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();

  if (!slug) {
    return jsonError("Укажите slug организации", 400);
  }

  try {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name, type, slug, phone, email, timezone, created_at")
      .eq("slug", slug)
      .maybeSingle();

    if (organizationError) {
      return jsonError(organizationError.message, 500);
    }

    if (!organization) {
      return jsonError("Организация не найдена", 404);
    }

    const { data: master, error: masterError } = await supabase
      .from("masters")
      .select("id, organization_id, name, phone, email, is_admin, created_at")
      .eq("organization_id", organization.id)
      .order("is_admin", { ascending: false })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (masterError) {
      return jsonError(masterError.message, 500);
    }

    if (!master) {
      return jsonError("Мастер не найден", 404);
    }

    const body: MasterResponse = {
      organization: organization as Organization,
      master: master as Master,
    };

    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить мастера";
    return jsonError(message, 500);
  }
}
