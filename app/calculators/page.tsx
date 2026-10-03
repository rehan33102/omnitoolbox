import Image from "next/image";
import { buildMetadata, softwareAppJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { serverSiteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import CurrencyConverter from "@/components/calc/CurrencyConverter";
import UnitConverter from "@/components/calc/UnitConverter";
import BmiCalculator from "@/components/calc/BmiCalculator";
import AgeCalculator from "@/components/calc/AgeCalculator";
import DynamicAdSlot from "@/components/layout/DynamicAdSlot";
import TrackUsage from "@/components/analytics/TrackUsage";
import Badge from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";

export const metadata = buildMetadata({
  title: "Free Calculators — Currency, Unit, BMI & Age Calculator",
  description: "Free online calculators: live currency converter (USD, PKR, EUR, USDT…), unit converter, BMI & calorie calculator, age calculator. No signup, instant results.",
  path: "/calculators",
  keywords: ["currency converter", "usd to pkr", "unit converter", "bmi calculator", "calorie calculator", "age calculator", "free calculators"],
});

export default function CalculatorsPage() {
  return (
    <div className="container py-10">
      <JsonLd data={[
        softwareAppJsonLd({ name: "OmniToolBox Calculators", description: "Free currency, unit, BMI and age calculators.", url: serverSiteUrl("/calculators"), category: "web" }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Calculators", path: "/calculators" }]),
      ]} />
      <TrackUsage slug="calculators" />

      <div className="max-w-3xl mb-8">
        <div className="flex gap-2 mb-4">
          <Badge variant="web">Calculators</Badge>
          <Badge variant="new">100% free</Badge>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Everyday <span className="text-gradient">Calculators</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Live currency rates, instant unit conversions, BMI & calorie targets,
          and exact age breakdowns — all calculated right in your browser.
        </p>
      </div>

      <div className="relative rounded-2xl overflow-hidden mb-8 border border-black/10 dark:border-white/10">
        <Image
          src="/images/web-tools-hero.webp"
          alt="Free online calculators — currency, unit, BMI and age"
          width={1200}
          height={480}
          className="w-full h-44 md:h-56 object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-transparent to-transparent" />
      </div>

      <Tabs defaultValue="currency">
        <TabsList>
          <TabsTrigger value="currency">💱 Currency</TabsTrigger>
          <TabsTrigger value="unit">📏 Units</TabsTrigger>
          <TabsTrigger value="bmi">🔥 BMI & Calories</TabsTrigger>
          <TabsTrigger value="age">🎂 Age</TabsTrigger>
        </TabsList>
        <TabsContent value="currency" id="currency"><CurrencyConverter /></TabsContent>
        <TabsContent value="unit" id="unit"><UnitConverter /></TabsContent>
        <TabsContent value="bmi" id="bmi"><BmiCalculator /></TabsContent>
        <TabsContent value="age" id="age"><AgeCalculator /></TabsContent>
      </Tabs>

      <DynamicAdSlot placement="calculators-bottom" format="horizontal" className="mt-10" />
    </div>
  );
}
