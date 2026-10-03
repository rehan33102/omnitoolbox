"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { lazyTool } from "@/components/ui/lazy-tool";

/**
 * Media tools load on-demand: each tab's JS (converter, compressor,
 * SVG cleaner, BG remover) downloads only when its tab is opened.
 * Keeps the initial /media-tools page load light on mobile.
 */
const ImageConverter = lazyTool(() => import("@/components/media/ImageConverter"));
const ImageCompressor = lazyTool(() => import("@/components/media/ImageCompressor"));
const SvgCleaner = lazyTool(() => import("@/components/media/SvgCleaner"));
const BackgroundRemover = lazyTool(() => import("@/components/media/BackgroundRemover"));

export default function MediaToolTabs() {
  return (
    <Tabs defaultValue="converter">
      <TabsList>
        <TabsTrigger value="converter">Converter</TabsTrigger>
        <TabsTrigger value="compressor">Compressor</TabsTrigger>
        <TabsTrigger value="svg">SVG Cleaner</TabsTrigger>
        <TabsTrigger value="bg">BG Remover</TabsTrigger>
      </TabsList>
      <TabsContent value="converter" id="converter"><ImageConverter /></TabsContent>
      <TabsContent value="compressor" id="compressor"><ImageCompressor /></TabsContent>
      <TabsContent value="svg" id="svg-cleaner"><SvgCleaner /></TabsContent>
      <TabsContent value="bg" id="bg-remover"><BackgroundRemover /></TabsContent>
    </Tabs>
  );
}
