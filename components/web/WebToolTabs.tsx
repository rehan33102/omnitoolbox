"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { lazyTool } from "@/components/ui/lazy-tool";
import PasswordGenerator from "@/components/web/PasswordGenerator";

/**
 * QR generator (qrcode lib) loads on-demand; the tiny password
 * generator stays eager so the second tab opens instantly.
 */
const QrGenerator = lazyTool(() => import("@/components/web/QrGenerator"));

export default function WebToolTabs() {
  return (
    <Tabs defaultValue="qr">
      <TabsList>
        <TabsTrigger value="qr">QR Generator</TabsTrigger>
        <TabsTrigger value="password">Password Generator</TabsTrigger>
      </TabsList>
      <TabsContent value="qr" id="qr"><QrGenerator /></TabsContent>
      <TabsContent value="password" id="password"><PasswordGenerator /></TabsContent>
    </Tabs>
  );
}
