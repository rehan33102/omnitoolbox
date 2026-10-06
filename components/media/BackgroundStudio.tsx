/* =====================================================================
 * Background Studio — Pro full editor.
 * Upload once → AI removes background → change it to anything:
 * solid colors, gradients, blurred original, custom photo, preset scenes.
 * Plus drop shadow + foreground tweaks. Live preview. HD download.
 * 100% client-side (server API tried first for speed, on-device fallback).
 * ===================================================================== */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { loadBgEngine, removeBackgroundSmart, type ProgressCb, type RemoveFn } from "@/lib/bg-engine";
import { formatBytes } from "@/lib/utils";
import { saveBlob } from "@/lib/db";
import { saveToLibrary } from "@/lib/library-save";
import { downloadBlob } from "@/lib/download";

type BgKind = "transparent" | "color" | "gradient" | "blur" | "image" | "preset";

const COLOR_SWATCHES = [
  "#ffffff", "#f5f5f4", "#e7e5e4", "#a8a29e", "#57534e", "#1c1917", "#000000",
  "#ef4444", "#dc2626", "#991b1b", "#f97316", "#ea580c", "#f59e0b", "#fbbf24",
  "#84cc16", "#65a30d", "#22c55e", "#16a34a", "#14b8a6", "#0d9488", "#06b6d4",
  "#0284c7", "#3b82f6", "#2563eb", "#1e40af", "#6366f1", "#4f46e5", "#a855f7",
  "#7e22ce", "#d946ef", "#a21caf", "#ec4899", "#db2777", "#9d174d", "#f43f5e",
  "#e11d48", "#881337", "#fb7185", "#fda4af", "#fecdd3",
];

const GRADIENTS: { name: string; from: string; to: string }[] = [
  { name: "Sunset", from: "#ff9a56", to: "#ff5e8a" },
  { name: "Ocean", from: "#2193b0", to: "#6dd5ed" },
  { name: "Violet", from: "#7c3aed", to: "#db2777" },
  { name: "Forest", from: "#134e5e", to: "#71b280" },
  { name: "Peach", from: "#ffecd2", to: "#fcb69f" },
  { name: "Midnight", from: "#232526", to: "#414345" },
  { name: "Candy", from: "#a18cd1", to: "#fbc2eb" },
  { name: "Fire", from: "#f83600", to: "#f9d423" },
];

const SCENE_CATEGORIES: { name: string; icon: string; scenes: { name: string; img: string }[] }[] = [
  { name: "Cars", icon: "\ud83d\ude97", scenes: [
    { name: "Sports Car", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80" },
    { name: "Classic Car", img: "https://images.unsplash.com/photo-1494905998402-395d579af36f?w=800&q=80" },
    { name: "Luxury Car", img: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80" },
    { name: "Red Car", img: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80" },
    { name: "Car Night", img: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80" },
    { name: "Vintage", img: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800&q=80" },
    { name: "Supercar", img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80" },
    { name: "Car Road", img: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80" },
    { name: "Muscle Car", img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80" },
    { name: "Car Sunset", img: "https://images.unsplash.com/photo-1493238792000-8113da705763?w=800&q=80" },
    { name: "Black Car", img: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80" },
    { name: "Car Interior", img: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80" },
    { name: "Race Track", img: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80" },
    { name: "Convertible", img: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80" },
    { name: "Car Desert", img: "https://images.unsplash.com/photo-1535732820275-9ffd998cac22?w=800&q=80" },
    { name: "Electric Car", img: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80" },
    { name: "Car Show", img: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80" },
    { name: "Oldtimer", img: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&q=80" },
    { name: "Car Lights", img: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=800&q=80" },
    { name: "SUV", img: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80" },
  ]},
  { name: "Animals", icon: "\ud83e\udd81", scenes: [
    { name: "Lion", img: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&q=80" },
    { name: "Tiger", img: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=800&q=80" },
    { name: "Elephant", img: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=800&q=80" },
    { name: "Dog", img: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80" },
    { name: "Cat", img: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80" },
    { name: "Horse", img: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80" },
    { name: "Bird", img: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&q=80" },
    { name: "Panda", img: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800&q=80" },
    { name: "Wolf", img: "https://images.unsplash.com/photo-1547407139-3c921a66005c?w=800&q=80" },
    { name: "Deer", img: "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=800&q=80" },
    { name: "Monkey", img: "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=800&q=80" },
    { name: "Bear", img: "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&q=80" },
    { name: "Fox", img: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&q=80" },
    { name: "Rabbit", img: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&q=80" },
    { name: "Parrot", img: "https://images.unsplash.com/photo-1552728089-57bdde30beb1?w=800&q=80" },
    { name: "Owl", img: "https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=800&q=80" },
    { name: "Giraffe", img: "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=800&q=80" },
    { name: "Zebra", img: "https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=800&q=80" },
    { name: "Kangaroo", img: "https://images.unsplash.com/photo-1551009175-8a68da93d5f9?w=800&q=80" },
    { name: "Penguin", img: "https://images.unsplash.com/photo-1551986782-d0169b3f8fa7?w=800&q=80" },
  ]},
  { name: "Houses", icon: "\ud83c\udfe0", scenes: [
    { name: "Modern House", img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80" },
    { name: "Villa", img: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80" },
    { name: "Cottage", img: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800&q=80" },
    { name: "Mansion", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80" },
    { name: "Cabin", img: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800&q=80" },
    { name: "Beach House", img: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80" },
    { name: "Farmhouse", img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80" },
    { name: "Penthouse", img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80" },
    { name: "Treehouse", img: "https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800&q=80" },
    { name: "Castle Home", img: "https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800&q=80" },
    { name: "White House", img: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80" },
    { name: "Brick House", img: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80" },
    { name: "Lake House", img: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80" },
    { name: "Desert Home", img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80" },
    { name: "Glass House", img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80" },
    { name: "Country Home", img: "https://images.unsplash.com/photo-1592595896551-12b371d546d5?w=800&q=80" },
    { name: "City Apartment", img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80" },
    { name: "Wooden Hut", img: "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=800&q=80" },
    { name: "Luxury Villa", img: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80" },
    { name: "Small Cottage", img: "https://images.unsplash.com/photo-1595846519845-68e298c2edd8?w=800&q=80" },
  ]},
  { name: "Sea & Ocean", icon: "\ud83c\udf0a", scenes: [
    { name: "Ocean Wave", img: "https://images.unsplash.com/photo-1439405326854-014607f694d7?w=800&q=80" },
    { name: "Tropical Beach", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80" },
    { name: "Sunset Sea", img: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80" },
    { name: "Island", img: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80" },
    { name: "Coral Reef", img: "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=800&q=80" },
    { name: "Deep Blue", img: "https://images.unsplash.com/photo-1551244072-5d12893278ab?w=800&q=80" },
    { name: "Sailboat", img: "https://images.unsplash.com/photo-1500930287596-c1ecaa373bb2?w=800&q=80" },
    { name: "Surf Wave", img: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80" },
    { name: "Beach Palm", img: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80" },
    { name: "Ocean Cliff", img: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80" },
    { name: "Sea Turtle", img: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80" },
    { name: "Dolphin", img: "https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=800&q=80" },
    { name: "Beach Sunset", img: "https://images.unsplash.com/photo-1495954484750-af469f2f9be5?w=800&q=80" },
    { name: "Aerial Ocean", img: "https://images.unsplash.com/photo-1515238152791-8216bfdf89a7?w=800&q=80" },
    { name: "Rocky Shore", img: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80" },
    { name: "Calm Sea", img: "https://images.unsplash.com/photo-1439405326854-014607f694d7?w=800&q=80" },
    { name: "Storm Sea", img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80" },
    { name: "Lagoon", img: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80" },
    { name: "Pier", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80" },
    { name: "Underwater", img: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800&q=80" },
  ]},
  { name: "Mountains", icon: "\u26f0", scenes: [
    { name: "Snow Peak", img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80" },
    { name: "Alps", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80" },
    { name: "Mountain Lake", img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80" },
    { name: "Rocky Peak", img: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80" },
    { name: "Himalaya", img: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80" },
    { name: "Green Valley", img: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80" },
    { name: "Misty Mount", img: "https://images.unsplash.com/photo-1476900543704-4312b78632f8?w=800&q=80" },
    { name: "Sunrise Peak", img: "https://images.unsplash.com/photo-1465056836041-7f43ac27dcb5?w=800&q=80" },
    { name: "Winter Mount", img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80" },
    { name: "Canyon", img: "https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=800&q=80" },
    { name: "Volcano", img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80" },
    { name: "Cliff", img: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80" },
    { name: "Mountain Road", img: "https://images.unsplash.com/photo-1465447142348-e9952c393450?w=800&q=80" },
    { name: "Peak Clouds", img: "https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=800&q=80" },
    { name: "Forest Mount", img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80" },
    { name: "Desert Mount", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80" },
    { name: "Lake Peak", img: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80" },
    { name: "Night Mount", img: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80" },
    { name: "Autumn Mount", img: "https://images.unsplash.com/photo-1507371341162-763b5e419408?w=800&q=80" },
    { name: "Glacier", img: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=800&q=80" },
  ]},
  { name: "City", icon: "\ud83c\udf06", scenes: [
    { name: "New York", img: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80" },
    { name: "Night City", img: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80" },
    { name: "Street", img: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" },
    { name: "Skyline", img: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&q=80" },
    { name: "Downtown", img: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80" },
    { name: "Bridge City", img: "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&q=80" },
    { name: "Neon Street", img: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80" },
    { name: "Old Town", img: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80" },
    { name: "Skyscraper", img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80" },
    { name: "City Park", img: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80" },
    { name: "Rooftop", img: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80" },
    { name: "Metro", img: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80" },
    { name: "City Rain", img: "https://images.unsplash.com/photo-1428592953211-077101b2021b?w=800&q=80" },
    { name: "Market", img: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80" },
    { name: "City Sunset", img: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80" },
    { name: "Alley", img: "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=800&q=80" },
    { name: "Plaza", img: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80" },
    { name: "City Lights", img: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80" },
    { name: "Harbor", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80" },
    { name: "City Aerial", img: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&q=80" },
  ]},
  { name: "Nature", icon: "\ud83c\udf33", scenes: [
    { name: "Forest", img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80" },
    { name: "Waterfall", img: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80" },
    { name: "Meadow", img: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80" },
    { name: "Flowers", img: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=80" },
    { name: "Garden", img: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80" },
    { name: "Rainforest", img: "https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=800&q=80" },
    { name: "Sunflower", img: "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?w=800&q=80" },
    { name: "Lavender", img: "https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=800&q=80" },
    { name: "Bamboo", img: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80" },
    { name: "Moss", img: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80" },
    { name: "Autumn Leaf", img: "https://images.unsplash.com/photo-1507371341162-763b5e419408?w=800&q=80" },
    { name: "Cherry", img: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&q=80" },
    { name: "Tulip", img: "https://images.unsplash.com/photo-1520763185298-1b434c919102?w=800&q=80" },
    { name: "Daisy", img: "https://images.unsplash.com/photo-1560717789-0ac7c58ac90a?w=800&q=80" },
    { name: "Rose", img: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800&q=80" },
    { name: "Fern", img: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80" },
    { name: "Pine", img: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80" },
    { name: "Jungle", img: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80" },
    { name: "Grass", img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80" },
    { name: "Dew", img: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&q=80" },
  ]},
  { name: "Sky & Space", icon: "\u2728", scenes: [
    { name: "Galaxy", img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80" },
    { name: "Stars", img: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80" },
    { name: "Milky Way", img: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80" },
    { name: "Aurora", img: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=800&q=80" },
    { name: "Clouds", img: "https://images.unsplash.com/photo-1534088568595-a066f6db0478?w=800&q=80" },
    { name: "Sunset Sky", img: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800&q=80" },
    { name: "Blue Sky", img: "https://images.unsplash.com/photo-1419833173245-f59e1b93f9ee?w=800&q=80" },
    { name: "Storm", img: "https://images.unsplash.com/photo-1534088568595-a066f6db0478?w=800&q=80" },
    { name: "Rainbow", img: "https://images.unsplash.com/photo-1501436513145-30f24e19fcc8?w=800&q=80" },
    { name: "Moon", img: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=800&q=80" },
    { name: "Sunrise", img: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80" },
    { name: "Nebula", img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80" },
    { name: "Lightning", img: "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?w=800&q=80" },
    { name: "Eclipse", img: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=800&q=80" },
    { name: "Comet", img: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80" },
    { name: "Planet", img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80" },
    { name: "Balloon Sky", img: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=800&q=80" },
    { name: "Kite Sky", img: "https://images.unsplash.com/photo-1501436513145-30f24e19fcc8?w=800&q=80" },
    { name: "Birds Sky", img: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&q=80" },
    { name: "Night Sky", img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80" },
  ]},
  { name: "Office", icon: "\ud83d\udcbc", scenes: [
    { name: "Modern Office", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80" },
    { name: "Workspace", img: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80" },
    { name: "Desk", img: "https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?w=800&q=80" },
    { name: "Meeting", img: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=800&q=80" },
    { name: "Laptop Desk", img: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80" },
    { name: "Creative", img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80" },
    { name: "Studio Desk", img: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80" },
    { name: "Library", img: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80" },
    { name: "Cafe Work", img: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80" },
    { name: "Home Office", img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80" },
    { name: "Boardroom", img: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=800&q=80" },
    { name: "Cowork", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80" },
    { name: "Minimal Desk", img: "https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?w=800&q=80" },
    { name: "Plant Office", img: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80" },
    { name: "Window Desk", img: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80" },
    { name: "Team", img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80" },
    { name: "Presentation", img: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=800&q=80" },
    { name: "Lounge", img: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80" },
    { name: "Dark Office", img: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80" },
    { name: "Bright Office", img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80" },
  ]},
  { name: "Food", icon: "\ud83c\udf54", scenes: [
    { name: "Pizza", img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80" },
    { name: "Burger", img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80" },
    { name: "Sushi", img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80" },
    { name: "Pasta", img: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80" },
    { name: "Dessert", img: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80" },
    { name: "Coffee", img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80" },
    { name: "Breakfast", img: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80" },
    { name: "Salad", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80" },
    { name: "Steak", img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80" },
    { name: "Ice Cream", img: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80" },
    { name: "Cake", img: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80" },
    { name: "Fruit", img: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&q=80" },
    { name: "BBQ", img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80" },
    { name: "Noodles", img: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80" },
    { name: "Tacos", img: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=80" },
    { name: "Pancake", img: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80" },
    { name: "Sandwich", img: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80" },
    { name: "Donut", img: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=80" },
    { name: "Tea", img: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80" },
    { name: "Juice", img: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800&q=80" },
  ]},
  { name: "Travel", icon: "\u2708", scenes: [
    { name: "Eiffel Tower", img: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800&q=80" },
    { name: "Taj Mahal", img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80" },
    { name: "Santorini", img: "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80" },
    { name: "Dubai", img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" },
    { name: "Bali", img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80" },
    { name: "Paris Street", img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80" },
    { name: "London", img: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80" },
    { name: "Tokyo", img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80" },
    { name: "Maldives", img: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80" },
    { name: "Swiss Alps", img: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80" },
    { name: "Egypt", img: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?w=800&q=80" },
    { name: "Greece", img: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80" },
    { name: "Venice", img: "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800&q=80" },
    { name: "Airport", img: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80" },
    { name: "Road Trip", img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80" },
    { name: "Cruise", img: "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=800&q=80" },
    { name: "Desert Safari", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80" },
    { name: "Northern Trip", img: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=800&q=80" },
    { name: "Waterfall Trip", img: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80" },
    { name: "City Tour", img: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" },
  ]},
  { name: "Sports", icon: "\u26bd", scenes: [
    { name: "Stadium", img: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80" },
    { name: "Football", img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
    { name: "Basketball", img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
    { name: "Tennis", img: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80" },
    { name: "Cricket", img: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80" },
    { name: "Gym", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80" },
    { name: "Running", img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" },
    { name: "Swimming", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80" },
    { name: "Cycling", img: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&q=80" },
    { name: "Boxing", img: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80" },
    { name: "Yoga", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80" },
    { name: "Skiing", img: "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80" },
    { name: "Surfing", img: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80" },
    { name: "Golf", img: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&q=80" },
    { name: "Skateboard", img: "https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=800&q=80" },
    { name: "Climbing", img: "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&q=80" },
    { name: "Racing", img: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80" },
    { name: "Volleyball", img: "https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&q=80" },
    { name: "Badminton", img: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80" },
    { name: "Marathon", img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" },
  ]},
];

// Flat list for canvas rendering (category-scene index mapping)
const PRESETS: { name: string; css: string; img: string }[] =
  SCENE_CATEGORIES.flatMap((c) => c.scenes.map((s) => ({ name: `${c.name} - ${s.name}`, css: "", img: s.img })));


export default function BackgroundStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "removing" | "studio">("upload");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  // studio state
  const [bgKind, setBgKind] = useState<BgKind>("transparent");
  const [color, setColor] = useState("#ffffff");
  const [gradIdx, setGradIdx] = useState(0);
  const [gradAngle, setGradAngle] = useState(135);
  const [blurAmt, setBlurAmt] = useState(12);
  const [presetIdx, setPresetIdx] = useState(0);
  const [sceneCat, setSceneCat] = useState(0);
  const [, setSceneTick] = useState(0);

  // Preload scene photos so canvas shows real images, not fallback
  useEffect(() => {
    PRESETS.forEach((p, i) => {
      if (sceneImgCache.has(i)) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setSceneTick((t) => t + 1);
      img.src = p.img;
      sceneImgCache.set(i, img);
    });
  }, []);
  const [shadowOn, setShadowOn] = useState(true);
  const [shadowOpacity, setShadowOpacity] = useState(0.35);
  const [shadowBlur, setShadowBlur] = useState(24);
  const [shadowY, setShadowY] = useState(18);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [busy, setBusy] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement | null>(null);      // cutout RGBA
  const origRef = useRef<HTMLCanvasElement | null>(null);    // original (for blur bg)
  const customBgRef = useRef<HTMLCanvasElement | null>(null);// uploaded bg
  const silhouetteRef = useRef<HTMLCanvasElement | null>(null);
  const dimsRef = useRef({ w: 0, h: 0 });
  const removeFn = useRef<RemoveFn | null>(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null); setStage("upload"); setProgress(0); setStatus("");
    fgRef.current = null; origRef.current = null; customBgRef.current = null;
  };

  /* ---------------- removal ---------------- */

  const onFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("image/")) { toast({ title: "Please choose an image file", variant: "error" }); return; }
    if (f.size > 12 * 1024 * 1024) { toast({ title: "Image too large — please use one under 12 MB.", variant: "error" }); return; }
    setFile(f);
    setStage("removing");
    setProgress(5);
    setStatus("Removing background…");
    try {
      const onProgress: ProgressCb = (_k, c, t) => { if (t > 0) setProgress(Math.min(90, Math.round((c / t) * 90))); };
      const ensure = async () => {
        if (!removeFn.current) removeFn.current = await loadBgEngine(onProgress);
        return removeFn.current;
      };
      const blob = await removeBackgroundSmart(f, onProgress, ensure);
      setProgress(92); setStatus("Preparing studio…");

      const bitmap = await createImageBitmap(blob);
      const fg = document.createElement("canvas");
      fg.width = bitmap.width; fg.height = bitmap.height;
      const fgCtx = fg.getContext("2d")!;
      fgCtx.drawImage(bitmap, 0, 0);
      bitmap.close();

      // Edge refine: smooth jagged alpha edges for cleaner cutout
      refineAlphaEdges(fg, 1.5);

      fgRef.current = fg;
      dimsRef.current = { w: fg.width, h: fg.height };

      // original for blur-bg
      const ob = await createImageBitmap(f);
      const orig = document.createElement("canvas");
      orig.width = fg.width; orig.height = fg.height;
      orig.getContext("2d")!.drawImage(ob, 0, 0, fg.width, fg.height);
      ob.close();
      origRef.current = orig;

      // black silhouette for drop shadow
      const sil = document.createElement("canvas");
      sil.width = fg.width; sil.height = fg.height;
      const sctx = sil.getContext("2d")!;
      sctx.drawImage(fg, 0, 0);
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = "#000";
      sctx.fillRect(0, 0, sil.width, sil.height);
      silhouetteRef.current = sil;

      setProgress(100);
      setStage("studio");
      toast({ title: "Background removed — welcome to the studio!", variant: "success" });
    } catch {
      setStage("upload");
      toast({ title: "Could not remove background. Please try again — if your connection is slow, the AI model needs more time to load.", variant: "error" });
    } finally {
      setProgress(0); setStatus("");
    }
  }, [toast]);

  /* ---------------- compositing ---------------- */

  const drawPreview = useCallback(() => {
    const cv = previewRef.current;
    const fg = fgRef.current;
    if (!cv || !fg) return;
    const { w, h } = dimsRef.current;
    // preview at max ~900px wide for speed; download renders full-res
    const scale = Math.min(1, 900 / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, pw, ph);

    const drawCover = (src: HTMLCanvasElement) => {
      const s = Math.max(pw / src.width, ph / src.height);
      const dw = src.width * s, dh = src.height * s;
      ctx.drawImage(src, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
    };

    if (bgKind === "transparent") {
      // checkerboard
      const s = 16;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pw, ph);
      ctx.fillStyle = "#d4d4d8";
      for (let y = 0; y < ph; y += s) for (let x = 0; x < pw; x += s)
        if (((x / s) + (y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
    } else if (bgKind === "color") {
      ctx.fillStyle = color; ctx.fillRect(0, 0, pw, ph);
    } else if (bgKind === "gradient") {
      const g = GRADIENTS[gradIdx];
      const rad = (gradAngle * Math.PI) / 180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      const grad = ctx.createLinearGradient(
        pw / 2 - dx * pw / 2, ph / 2 - dy * ph / 2,
        pw / 2 + dx * pw / 2, ph / 2 + dy * ph / 2
      );
      grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, pw, ph);
    } else if (bgKind === "blur") {
      const orig = origRef.current;
      if (orig) {
        ctx.save();
        ctx.filter = `blur(${Math.max(0, blurAmt * scale)}px)`;
        // expand slightly so blur edges don't show transparency
        const pad = blurAmt * scale * 2 + 4;
        const s = Math.max((pw + pad * 2) / orig.width, (ph + pad * 2) / orig.height);
        const dw = orig.width * s, dh = orig.height * s;
        ctx.drawImage(orig, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, 0, pw, ph);
      }
    } else if (bgKind === "image") {
      const cb = customBgRef.current;
      if (cb) drawCover(cb);
      else { ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, pw, ph); }
    } else if (bgKind === "preset") {
      // render the CSS preset into an offscreen canvas via gradient approximation
      const tmp = document.createElement("canvas");
      tmp.width = pw; tmp.height = ph;
      // draw CSS gradient by painting it on a div-free path: use a temp element trick
      // simplest reliable: fill with layered canvas gradients approximating common presets
      paintPreset(tmp, presetIdx);
      ctx.drawImage(tmp, 0, 0);
    }

    // drop shadow (behind subject)
    if (shadowOn && silhouetteRef.current) {
      ctx.save();
      ctx.globalAlpha = shadowOpacity;
      ctx.filter = `blur(${Math.max(0, shadowBlur * scale)}px)`;
      ctx.drawImage(silhouetteRef.current, 0, shadowY * scale, pw, ph);
      ctx.restore();
    }

    // foreground with adjustments
    ctx.save();
    if (brightness !== 100 || contrast !== 100)
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(fg, 0, 0, pw, ph);
    ctx.restore();
  }, [bgKind, color, gradIdx, gradAngle, blurAmt, presetIdx, shadowOn, shadowOpacity, shadowBlur, shadowY, brightness, contrast]);

  useEffect(() => { if (stage === "studio") drawPreview(); }, [stage, drawPreview]);

  /* ---------------- custom bg upload ---------------- */

  const onCustomBg = async (f: File) => {
    try {
      const b = await createImageBitmap(f);
      const c = document.createElement("canvas");
      c.width = b.width; c.height = b.height;
      c.getContext("2d")!.drawImage(b, 0, 0);
      b.close();
      customBgRef.current = c;
      setBgKind("image");
      toast({ title: "Custom background set", variant: "success" });
    } catch {
      toast({ title: "Could not read that image.", variant: "error" });
    }
  };

  /* ---------------- HD download ---------------- */

  const download = async (hd: boolean) => {
    const fg = fgRef.current;
    if (!fg || busy) return;
    setBusy(true);
    try {
      const { w, h } = dimsRef.current;
      const scale = hd ? 1 : Math.min(1, 900 / Math.max(w, h));
      const out = document.createElement("canvas");
      out.width = Math.round(w * scale); out.height = Math.round(h * scale);
      const ctx = out.getContext("2d")!;
      const pw = out.width, ph = out.height;

      if (bgKind === "color") { ctx.fillStyle = color; ctx.fillRect(0, 0, pw, ph); }
      else if (bgKind === "gradient") {
        const g = GRADIENTS[gradIdx];
        const rad = (gradAngle * Math.PI) / 180;
        const dx = Math.cos(rad), dy = Math.sin(rad);
        const gr = ctx.createLinearGradient(pw/2 - dx*pw/2, ph/2 - dy*ph/2, pw/2 + dx*pw/2, ph/2 + dy*ph/2);
        gr.addColorStop(0, g.from); gr.addColorStop(1, g.to);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, pw, ph);
      } else if (bgKind === "blur" && origRef.current) {
        ctx.save();
        ctx.filter = `blur(${blurAmt * scale}px)`;
        const pad = blurAmt * scale * 2 + 4;
        const s = Math.max((pw + pad * 2) / origRef.current.width, (ph + pad * 2) / origRef.current.height);
        const dw = origRef.current.width * s, dh = origRef.current.height * s;
        ctx.drawImage(origRef.current, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, 0, pw, ph);
      } else if (bgKind === "image" && customBgRef.current) {
        const src = customBgRef.current;
        const s = Math.max(pw / src.width, ph / src.height);
        const dw = src.width * s, dh = src.height * s;
        ctx.drawImage(src, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
      } else if (bgKind === "preset") {
        paintPreset(out, presetIdx);
      }
      // (transparent → leave empty)

      if (shadowOn && silhouetteRef.current) {
        ctx.save();
        ctx.globalAlpha = shadowOpacity;
        ctx.filter = `blur(${shadowBlur * scale}px)`;
        ctx.drawImage(silhouetteRef.current, 0, shadowY * scale, pw, ph);
        ctx.restore();
      }
      ctx.save();
      if (brightness !== 100 || contrast !== 100)
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(fg, 0, 0, pw, ph);
      ctx.restore();

      const blob = await new Promise<Blob | null>(res => out.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode");
      // Persist so the output survives refresh — best-effort, never blocks UX.
      try {
        void saveToLibrary("image", blob, hd ? "background-studio-hd.png" : "background-studio.png", {
          tool: "bg-studio",
          background: bgKind,
        });
      } catch {
        /* library save is non-critical */
      }
      downloadBlob(blob, hd ? "background-studio-hd.png" : "background-studio.png");
      toast({ title: `Downloaded ${hd ? "HD " : ""}PNG (${formatBytes(blob.size)})`, variant: "success" });
    } catch {
      toast({ title: "Export failed.", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- render ---------------- */

  if (stage === "upload") {
    return (
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center transition hover:border-fuchsia-500/50 hover:bg-white/[0.05]">
        <span className="text-4xl"></span>
        <span className="text-sm font-medium text-zinc-300">Tap to upload a photo</span>
        <span className="text-xs text-zinc-500">AI removes the background, then the studio opens — colors, gradients, blur, shadows & more</span>
        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>
    );
  }

  if (stage === "removing") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/[0.03] px-6 py-16 ring-1 ring-white/10">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
        <p className="text-sm text-zinc-300">{status || "Removing background…"}</p>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const tabs: { id: BgKind; label: string }[] = [
    { id: "transparent", label: "◻ None" },
    { id: "color", label: " Color" },
    { id: "gradient", label: " Gradient" },
    { id: "blur", label: " Blur" },
    { id: "image", label: " Photo" },
    { id: "preset", label: " Scenes" },
  ];

  return (
    <div className="space-y-4">
      {/* live preview */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
        <canvas ref={previewRef} className="block w-full" />
      </div>

      {/* bg type tabs */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setBgKind(t.id)}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
              bgKind === t.id ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25" : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* per-kind controls */}
      <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        {bgKind === "color" && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map(c => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  className={`h-8 w-8 rounded-full ring-2 transition ${color === c ? "ring-fuchsia-400 scale-110" : "ring-white/20"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Custom
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded bg-transparent" />
              <span className="font-mono text-zinc-300">{color}</span>
            </label>
          </div>
        )}
        {bgKind === "gradient" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-4 gap-1.5">
              {GRADIENTS.map((g, i) => (
                <button key={g.name} onClick={() => setGradIdx(i)}
                  className={`h-12 rounded-lg ring-2 transition ${gradIdx === i ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10"}`}
                  style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }} title={g.name} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Angle
              <input type="range" min={0} max={360} value={gradAngle} onChange={e => setGradAngle(+e.target.value)} className="flex-1 accent-fuchsia-500" />
              <span className="w-10 text-zinc-300">{gradAngle}°</span>
            </label>
          </div>
        )}
        {bgKind === "blur" && (
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Blur intensity
            <input type="range" min={0} max={40} value={blurAmt} onChange={e => setBlurAmt(+e.target.value)} className="flex-1 accent-fuchsia-500" />
            <span className="w-8 text-zinc-300">{blurAmt}</span>
          </label>
        )}
        {bgKind === "image" && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-xs font-semibold text-zinc-300 hover:border-fuchsia-500/50">
             Upload background photo
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onCustomBg(f); }} />
          </label>
        )}
        {bgKind === "preset" && (
          <div className="space-y-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5">
              {SCENE_CATEGORIES.map((c, ci) => (
                <button key={c.name} onClick={() => { setSceneCat(ci); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    sceneCat === ci ? "bg-fuchsia-600 text-white shadow-lg" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
            {/* Scenes in selected category */}
            <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
              {SCENE_CATEGORIES[sceneCat].scenes.map((s) => {
                const flatIdx = SCENE_CATEGORIES.slice(0, sceneCat).reduce((n, c) => n + c.scenes.length, 0)
                  + SCENE_CATEGORIES[sceneCat].scenes.indexOf(s);
                return (
                  <button key={s.name} onClick={() => setPresetIdx(flatIdx)}
                    className={`relative h-16 rounded-lg text-[11px] font-bold text-white ring-2 transition overflow-hidden ${presetIdx === flatIdx ? "ring-fuchsia-400 scale-[1.03]" : "ring-white/10"}`}>
                    <img src={s.img} alt={s.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/50 text-[10px] py-0.5 px-1 truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500">{SCENE_CATEGORIES[sceneCat].scenes.length} scenes in {SCENE_CATEGORIES[sceneCat].name} · {PRESETS.length} total</p>
          </div>
        )}
        {bgKind === "transparent" && (
          <p className="text-xs text-zinc-500">Transparent background — downloads as PNG with alpha.</p>
        )}
      </div>

      {/* shadow */}
      <div className="space-y-2.5 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        <button onClick={() => setShadowOn(v => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-zinc-200">
          <span> Drop shadow</span>
          <span className={`relative h-6 w-11 rounded-full transition ${shadowOn ? "bg-fuchsia-600" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${shadowOn ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>
        {shadowOn && (
          <>
            <Slider label="Opacity" value={shadowOpacity} min={0} max={1} step={0.05} onChange={setShadowOpacity} fmt={v => `${Math.round(v * 100)}%`} />
            <Slider label="Softness" value={shadowBlur} min={0} max={60} onChange={setShadowBlur} fmt={v => `${v}px`} />
            <Slider label="Distance" value={shadowY} min={0} max={80} onChange={setShadowY} fmt={v => `${v}px`} />
          </>
        )}
      </div>

      {/* foreground */}
      <div className="space-y-2.5 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
        <p className="text-sm font-semibold text-zinc-200"> Subject adjustments</p>
        <Slider label="Brightness" value={brightness} min={50} max={150} onChange={setBrightness} fmt={v => `${v}%`} />
        <Slider label="Contrast" value={contrast} min={50} max={150} onChange={setContrast} fmt={v => `${v}%`} />
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => download(true)} disabled={busy}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-50">
           Download HD
        </button>
        <button onClick={() => download(false)} disabled={busy}
          className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50">
          Quick PNG
        </button>
        <button onClick={reset} className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 hover:bg-white/10">
          New photo
        </button>
      </div>
      <p className="text-center text-[11px] text-zinc-600">HD renders at your photo&apos;s full original resolution.</p>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} className="flex-1 accent-fuchsia-500" />
      <span className="w-12 shrink-0 text-right text-zinc-300">{fmt(value)}</span>
    </label>
  );
}

/** Smooth jagged alpha edges on a cutout canvas for cleaner subject extraction. */
function refineAlphaEdges(cv: HTMLCanvasElement, radius: number) {
  const ctx = cv.getContext("2d")!;
  const w = cv.width, h = cv.height;
  // Step 1: slight blur on alpha only via temp canvas
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext("2d")!;
  tctx.filter = `blur(${radius}px)`;
  tctx.drawImage(cv, 0, 0);
  // Step 2: threshold semi-transparent fringe pixels
  const src = ctx.getImageData(0, 0, w, h);
  const blr = tctx.getImageData(0, 0, w, h);
  const d = src.data, b = blr.data;
  for (let i = 3; i < d.length; i += 4) {
    const a = b[i];
    // kill faint halo fringe, keep solid subject
    if (a < 24) d[i] = 0;
    else if (a < 128) d[i] = Math.round(a * 0.85);
  }
  ctx.putImageData(src, 0, 0);
}

/** Cache for preloaded scene images. */
const sceneImgCache = new Map<number, HTMLImageElement>();

function getSceneImage(idx: number): HTMLImageElement | null {
  const cached = sceneImgCache.get(idx);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = PRESETS[idx].img;
  sceneImgCache.set(idx, img);
  return null;
}

/** Draw cover-fit image. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw = w, dh = h;
  if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Paint a preset scene — real photo, gradient fallback while loading. */
function paintPreset(cv: HTMLCanvasElement, idx: number) {
  const ctx = cv.getContext("2d")!;
  const w = cv.width, h = cv.height;
  const img = getSceneImage(idx);
  if (img) {
    drawCover(ctx, img, w, h);
    return;
  }
  // fallback gradient while image loads
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#4c1d95"); g.addColorStop(1, "#0f172a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
