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
const BackgroundStudio = lazyTool(() => import("@/components/media/BackgroundStudio"));
const WatermarkRemover = lazyTool(() => import("@/components/media/WatermarkRemover"));
const ThumbnailMaker = lazyTool(() => import("@/components/media/ThumbnailMaker"));

export default function MediaToolTabs() {
  return (
    <Tabs defaultValue="converter">
      <TabsList>
        <TabsTrigger value="converter">Converter</TabsTrigger>
        <TabsTrigger value="compressor">Compressor</TabsTrigger>
        <TabsTrigger value="svg">SVG Cleaner</TabsTrigger>
        <TabsTrigger value="studio">🎨 BG Studio</TabsTrigger>
        <TabsTrigger value="watermark">Watermark Remover</TabsTrigger>
        <TabsTrigger value="thumbnail">🖼️ Thumbnail Maker</TabsTrigger>
      </TabsList>
      <TabsContent value="converter" id="converter"><ImageConverter /></TabsContent>
      <TabsContent value="compressor" id="compressor"><ImageCompressor /></TabsContent>
      <TabsContent value="svg" id="svg-cleaner"><SvgCleaner /></TabsContent>
      <TabsContent value="studio" id="background-studio"><BackgroundStudio /></TabsContent>
      <TabsContent value="watermark" id="watermark-remover"><WatermarkRemover /></TabsContent>
      <TabsContent value="thumbnail" id="thumbnail-maker"><ThumbnailMaker /></TabsContent>
    </Tabs>
  );
}
