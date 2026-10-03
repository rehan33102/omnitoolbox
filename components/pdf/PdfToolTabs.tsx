"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { lazyTool } from "@/components/ui/lazy-tool";

/**
 * PDF tools load on-demand: pdf-lib (~400KB) only downloads when a tab
 * is opened, not on initial /pdf-tools page load.
 */
const PdfMerger = lazyTool(() => import("@/components/pdf/PdfMerger"));
const PdfSplitter = lazyTool(() => import("@/components/pdf/PdfSplitter"));
const ImagesToPdf = lazyTool(() => import("@/components/pdf/ImagesToPdf"));

export default function PdfToolTabs() {
  return (
    <Tabs defaultValue="merger">
      <TabsList>
        <TabsTrigger value="merger">Merge PDF</TabsTrigger>
        <TabsTrigger value="splitter">Split PDF</TabsTrigger>
        <TabsTrigger value="images">Images to PDF</TabsTrigger>
      </TabsList>
      <TabsContent value="merger" id="merger"><PdfMerger /></TabsContent>
      <TabsContent value="splitter" id="splitter"><PdfSplitter /></TabsContent>
      <TabsContent value="images" id="images-to-pdf"><ImagesToPdf /></TabsContent>
    </Tabs>
  );
}
