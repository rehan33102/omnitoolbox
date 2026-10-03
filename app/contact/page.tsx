"use client";

import { useState } from "react";
import { Mail, Send, MessageCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const CONTACT_EMAIL = "info.rehan3310@gmail.com";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

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
        <p className="text-zinc-400 mt-3">
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
            <Mail size={20} className="text-brand-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Email us directly</p>
              <p className="text-xs text-zinc-500 truncate">{CONTACT_EMAIL}</p>
            </div>
          </Card>
        </a>
        <Card className="flex items-center gap-3">
          <MessageCircle size={20} className="text-brand-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">Response time</p>
            <p className="text-xs text-zinc-500">Usually within 24–48 hours</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
