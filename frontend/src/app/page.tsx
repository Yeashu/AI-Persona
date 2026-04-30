"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Bot, Sparkles, MessageCircle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Persona = "anshuman" | "abhimanyu" | "kshitij";

const PERSONAS: {
  id: Persona;
  name: string;
  shortName: string;
  role: string;
  initials: string;
  description: string;
}[] = [
  {
    id: "anshuman",
    name: "Anshuman Singh",
    shortName: "Anshuman",
    role: "Tech Lead & Co-founder",
    initials: "AS",
    description: "DSA, System Design & Problem Solving",
  },
  {
    id: "abhimanyu",
    name: "Abhimanyu Saxena",
    shortName: "Abhimanyu",
    role: "Product & Co-founder",
    initials: "AB",
    description: "Career Strategy & Product Thinking",
  },
  {
    id: "kshitij",
    name: "Kshitij Mishra",
    shortName: "Kshitij",
    role: "Lead Instructor",
    initials: "KM",
    description: "DSA, LLD & Structured Learning",
  },
];

const PERSONA_SUGGEST: Record<Persona, string[]> = {
  anshuman: [
    "Tell me about your journey at Facebook",
    "How should I master Data Structures?",
    "What's the secret to cracking FAANG?",
  ],
  abhimanyu: [
    "How do I transition to a product company?",
    "Is AI going to replace engineers?",
    "How should I evaluate job offers?",
  ],
  kshitij: [
    "I'm struggling with recursion, any tips?",
    "How do I stay consistent with DSA practice?",
    "Do I need a Masters to get a top job?",
  ],
};

// ——— Transition presets ———
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const messageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

export default function Home() {
  const [activePersona, setActivePersona] = useState<Persona>("anshuman");
  const [messages, setMessages] = useState<Record<Persona, Message[]>>({
    anshuman: [],
    abhimanyu: [],
    kshitij: [],
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animatedCountRef = useRef<Record<Persona, number>>({
    anshuman: 0,
    abhimanyu: 0,
    kshitij: 0,
  });

  const currentMessages = messages[activePersona];
  const activePersonaData = PERSONAS.find((p) => p.id === activePersona)!;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activePersona]);

  const handlePersonaChange = (personaId: Persona) => {
    if (personaId === activePersona) return;
    setActivePersona(personaId);
    animatedCountRef.current[personaId] = 0;
    setMessages((prev) => ({
      ...prev,
      [personaId]: [],
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...currentMessages, userMessage];

    setMessages((prev) => ({
      ...prev,
      [activePersona]: updatedMessages,
    }));
    setInput("");
    setIsLoading(true);

    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: activePersona,
          messages: updatedMessages,
        }),
      });

      if (!res.ok) {
        let errMessage = "Failed to send message: " + res.statusText;
        try {
          const errData = await res.json();
          if (errData.message) {
            errMessage = errData.message;
          } else if (errData.detail) {
            errMessage = errData.detail;
          }
        } catch (e) {
          // Fallback to initial errMessage if it's not JSON
        }
        throw new Error(errMessage);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No reader found");

      let fullResponse = "";
      let assistantMessageCreated = false;
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            let dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            try {
              let parsed = JSON.parse(dataStr);
              if (typeof parsed === "string") {
                parsed = JSON.parse(parsed);
              }
              if (parsed.response != null) {
                fullResponse += parsed.response;

                if (!assistantMessageCreated) {
                  assistantMessageCreated = true;
                  setMessages((prev) => ({
                    ...prev,
                    [activePersona]: [
                      ...prev[activePersona],
                      { role: "assistant", content: fullResponse },
                    ],
                  }));
                } else {
                  setMessages((prev) => {
                    const newMsgs = [...prev[activePersona]];
                    const lastIndex = newMsgs.length - 1;
                    newMsgs[lastIndex] = {
                      ...newMsgs[lastIndex],
                      content: fullResponse,
                    };
                    return { ...prev, [activePersona]: newMsgs };
                  });
                }
              }
            } catch (err) {
              // Not a valid JSON or stream ended
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => ({
        ...prev,
        [activePersona]: [
          ...prev[activePersona],
          {
            role: "assistant",
            content: error.message || "Failed to connect to the server.",
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (chip: string) => {
    setInput(chip);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div
      className="flex h-screen flex-col md:flex-row"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* ===== SIDEBAR ===== */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="sidebar hidden md:flex w-72 flex-col"
        style={{ zIndex: 10 }}
      >
        {/* Logo */}
        <div className="px-6 pt-7 pb-2">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--gradient-accent)",
                boxShadow: "0 4px 16px var(--accent-glow)",
              }}
            >
              <Sparkles size={18} color="white" />
            </div>
            <h1 className="text-lg font-bold logo-text">Persona AI</h1>
          </div>
          <p
            className="text-xs mt-3 pl-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Choose a mentor to chat with
          </p>
        </div>

        {/* Persona List */}
        <nav className="flex-1 px-4 py-4 flex flex-col gap-2">
          {PERSONAS.map((persona) => (
            <motion.button
              key={persona.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePersonaChange(persona.id)}
              className={`persona-btn ${
                activePersona === persona.id ? "active" : ""
              } text-left`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`avatar avatar-bot-sidebar ${
                    activePersona === persona.id ? "active" : ""
                  }`}
                  style={{ width: 38, height: 38, borderRadius: 12, fontSize: 13 }}
                >
                  {persona.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold text-sm truncate"
                      style={{
                        color:
                          activePersona === persona.id
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {persona.shortName}
                    </span>
                    {activePersona === persona.id && (
                      <motion.div
                        layoutId="active-dot"
                        className="active-dot"
                      />
                    )}
                  </div>
                  <span
                    className="text-xs block truncate mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {persona.role}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div
          className="px-6 py-4 text-xs"
          style={{
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <Zap size={12} />
            <span>Powered by AI</span>
          </div>
        </div>
      </motion.aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <main
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{ background: "var(--bg-secondary)" }}
      >
        {/* Ambient glow */}
        <div
          className="ambient-glow"
          style={{ top: "-200px", right: "-200px" }}
        />
        <div
          className="ambient-glow"
          style={{ bottom: "-200px", left: "-200px", opacity: 0.04 }}
        />

        {/* Mobile persona selector */}
        <div
          className="md:hidden flex gap-2 px-4 pt-4 pb-2 overflow-x-auto"
          style={{
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              onClick={() => handlePersonaChange(persona.id)}
              className={`persona-btn ${
                activePersona === persona.id ? "active" : ""
              } flex-shrink-0`}
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              {persona.shortName}
            </button>
          ))}
        </div>

        {/* Chat Header */}
        <motion.header
          key={activePersona + "-header"}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="chat-header px-6 py-4 flex items-center gap-4"
          style={{ zIndex: 5 }}
        >
          <div
            className="avatar avatar-bot"
            style={{ width: 42, height: 42, borderRadius: 14, fontSize: 14 }}
          >
            <Bot size={20} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h2
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)" }}
              >
                {activePersonaData.name}
              </h2>
              <span className="role-tag">{activePersonaData.role}</span>
            </div>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {activePersonaData.description}
            </p>
          </div>
        </motion.header>

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto px-4 md:px-6 py-6 min-h-0"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className="max-w-3xl mx-auto min-h-full flex flex-col">
            <AnimatePresence mode="wait">
              {currentMessages.length === 0 ? (
                <motion.div
                  key={activePersona + "-empty"}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="flex-1 flex flex-col items-center justify-center p-6"
                >
                  {/* Empty state */}
                  <motion.div
                    variants={itemVariants}
                    className="flex flex-col items-center"
                  >
                    <div
                      className="avatar avatar-bot"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 20,
                        fontSize: 22,
                        marginBottom: 20,
                      }}
                    >
                      <MessageCircle size={28} color="white" />
                    </div>
                    <h3
                      className="text-xl font-semibold mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Chat with {activePersonaData.shortName}
                    </h3>
                    <p
                      className="text-sm text-center max-w-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Ask about{" "}
                      {activePersonaData.description.toLowerCase()}, or
                      pick a suggestion below to get started.
                    </p>
                  </motion.div>

                  {/* Suggestion Chips */}
                  <motion.div
                    variants={itemVariants}
                    className="mt-8 flex flex-wrap gap-3 justify-center max-w-lg"
                  >
                    {PERSONA_SUGGEST[activePersona].map((chip, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleChipClick(chip)}
                        className="chip"
                      >
                        {chip}
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key={activePersona + "-list"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col justify-end space-y-5"
                >
                  {currentMessages.map((msg, index) => {
                    const isNew =
                      index >= animatedCountRef.current[activePersona];
                    if (index >= animatedCountRef.current[activePersona]) {
                      animatedCountRef.current[activePersona] = index + 1;
                    }
                    return (
                      <motion.div
                        key={`${activePersona}-${index}`}
                        initial={isNew ? { opacity: 0, y: 16 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        className={`flex gap-3 ${
                          msg.role === "user" ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`avatar ${
                            msg.role === "user" ? "avatar-user" : "avatar-bot"
                          }`}
                        >
                          {msg.role === "user" ? (
                            <User size={16} />
                          ) : (
                            <Bot size={16} color="white" />
                          )}
                        </div>

                        {/* Bubble */}
                        <div
                          className={`px-5 py-3.5 max-w-[80%] ${
                            msg.role === "user" ? "msg-user" : "msg-assistant"
                          }`}
                        >
                          <p
                            className="whitespace-pre-wrap text-sm leading-relaxed"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {msg.content}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Typing indicator */}
                  {isLoading &&
                    currentMessages.length > 0 &&
                    currentMessages[currentMessages.length - 1].role ===
                      "user" && (
                      <motion.div
                        variants={messageVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex gap-3 flex-row"
                      >
                        <div className="avatar avatar-bot">
                          <Bot size={16} color="white" />
                        </div>
                        <div className="msg-assistant px-5 py-4">
                          <div className="typing-dots">
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      </motion.div>
                    )}

                  <div ref={messagesEndRef} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="input-area px-4 md:px-6 py-4" style={{ zIndex: 5 }}>
          <form
            className="max-w-3xl mx-auto relative"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${activePersonaData.shortName} something...`}
              className="chat-input"
              disabled={isLoading}
            />
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              type="submit"
              disabled={!input.trim() || isLoading}
              className="send-btn"
            >
              <Send size={16} />
            </motion.button>
          </form>
        </div>
      </main>
    </div>
  );
}
