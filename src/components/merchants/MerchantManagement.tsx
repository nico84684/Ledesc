
"use client";

import { AddMerchantForm } from "./AddMerchantForm";
import { MerchantListTable } from "./MerchantListTable";
import { Separator } from "@/components/ui/separator";

export function MerchantManagement() {
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <AddMerchantForm />
      </div>
      <div className="lg:col-span-2">
        <MerchantListTable />
      </div>
    </div>
  );
}
