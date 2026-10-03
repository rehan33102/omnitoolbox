"use client";

import { useState } from "react";
import { Github, Instagram, Mail, Send, MessageCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WHATSAPP_MESSAGE, normalizeWhatsapp, whatsappUrl } from "@/lib/site-settings";
import { TikTokIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";

const CONTACT_EMAIL = "info.rehan3310@gmail.com";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const { settings } = useSiteSettings();

  const socials = [
    {
      label: "WhatsApp",
      sub: "Chat with us directly",
      href: whatsappUrl(settings.whatsapp, WHATSAPP_MESSAGE),
      Icon: WhatsAppIcon,
      show: !!normalizeWhatsapp(settings.whatsapp),
    },
    { label: "TikTok", sub: "@rehan331022", href: settings.tiktok, Icon: TikTokIcon, show: !!settings.tiktok },
    { label: "Instagram", sub: "Follow us", href: settings.instagram, Icon: Instagram, show: !!settings.instagram },
    { label: "GitHub", sub: "rehan33102", href: settings.github, Icon: Github, show: !!settings.github },
  ].filter((s) => s.show);

  const send = () => {
    if (!message.trim()) {
      toast({ title: "Please write a message", variant: "error" });
      return;
    }
    const body = `Name: ${name.trim() || "(not given)"}\n\n${message.trim()}`;
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject.trim() || "OmniToolBox — Contact")}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast({ title: "Opening your email app…", variant: "success", description: "Your message is pre-filled — just hit send." });
  };

  return (
    <div className="container py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
          Contact <span className="text-gradient">Us</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-3">
          Questions, feedback, or a tool you wish existed? We read every message.
        </p>
      </div>

      <Card className="space-y-4">
        <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Feature request…" />
        <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what's on your mind…" rows={6} />
        <Button onClick={send} className="w-full">
          <Send size={16} /> Send message
        </Button>
        <p className="text-xs text-zinc-500 text-center">
          This opens your email app with the message pre-filled — no account needed, nothing stored.
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <a href={`mailto:${CONTACT_EMAIL}`}>
          <Card hover className="flex items-center gap-3">
            <Mail size={20} className="text-brand-700 dark:text-brand-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Email us directly</p>
              <p className="text-xs text-zinc-500 truncate">{CONTACT_EMAIL}</p>
            </div>
          </Card>
        </a>
        <Card className="flex items-center gap-3">
          <MessageCircle size={20} className="text-brand-700 dark:text-brand-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">Response time</p>
            <p className="text-xs text-zinc-500">Usually within 24–48 hours</p>
          </div>
        </Card>
      </div>

      {socials.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold mb-4">Find us on social</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {socials.map(({ label, sub, href, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                <Card hover className="flex flex-col items-center gap-2 py-5 text-center">
                  <Icon size={22} className="text-zinc-800 dark:text-zinc-200" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-zinc-500 truncate max-w-[120px]">{sub}</p>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
