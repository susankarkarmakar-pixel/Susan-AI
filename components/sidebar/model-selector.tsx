"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Bot, Sparkles, BrainCircuit, Globe, Cpu, Hexagon, Zap, Shield, Code2, Flame, Network, Cloud, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { INSTANT_CHAT_PROVIDERS, ModelProvider } from "@/lib/ai-providers";
import { getApiKey, getKeys, ApiKeys } from "@/lib/key-storage";
import { CustomProvider, getCustomProviders } from "@/lib/custom-providers";
import { getProviderDescriptor } from "@/lib/provider-capabilities";

// Update ModelOption to match ModelProvider
export type ModelOption = Exclude<ModelProvider, "manus"> | string;

interface ModelSelectorProps {
  selected: ModelOption;
  onSelect: (model: ModelOption) => void;
  collapsed?: boolean;
}

const MODEL_ICONS: Record<Exclude<ModelProvider, "manus">, LucideIcon> = {
  deepseek: BrainCircuit,
  anthropic: Sparkles,
  huggingface: Bot,
  google: Globe,
  openai: Cpu,
  qwen: Hexagon,
  kimi: Zap,
  sarvam: Shield,
  openrouter: Globe,
  groq: Flame,
  cerebras: Network,
  mistral: Sparkles,
  nvidia: Cpu,
  cloudflare: Cloud,
  sambanova: Globe,
  xai: Sparkles,
  perplexity: Globe,
  together: Network,
  jules: Code2,
};

const MODELS = INSTANT_CHAT_PROVIDERS.map((id) => {
  const descriptor = getProviderDescriptor(id);
  return { id, name: descriptor?.name || id, description: descriptor?.description || "", icon: MODEL_ICONS[id] };
});
const julesDescriptor = getProviderDescriptor("jules");
const AGENT_MODELS = [{ id: "jules", name: julesDescriptor?.name || "Google Jules", description: julesDescriptor?.description || "", icon: MODEL_ICONS.jules }];

export function ModelSelector({ selected, onSelect, collapsed = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setTimeout(() => {
      setKeys(getKeys());
      setCustomProviders(getCustomProviders());
    }, 0);
    const handleKeysUpdated = () => setKeys(getKeys());
    const handleCustomProvidersUpdated = () => setCustomProviders(getCustomProviders());
    window.addEventListener('keys-updated', handleKeysUpdated);
    window.addEventListener('custom-providers-updated', handleCustomProvidersUpdated);
    return () => { window.removeEventListener('keys-updated', handleKeysUpdated); window.removeEventListener('custom-providers-updated', handleCustomProvidersUpdated); };
  }, []);

  const availableModels = [...MODELS, ...AGENT_MODELS, ...customProviders.map((provider) => ({ id: provider.id, name: provider.name, description: provider.model, icon: Globe }))];
  const selectedModel = availableModels.find(m => m.id === selected) || availableModels[0];
  const Icon = selectedModel.icon;
  const selectedIndex = Math.max(0, availableModels.findIndex((model) => model.id === selected));

  const openSelector = (index = selectedIndex) => {
    setActiveIndex(index);
    setIsOpen(true);
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const moveActive = (direction: 1 | -1) => {
    const nextIndex = (activeIndex + direction + availableModels.length) % availableModels.length;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSelector();
          }
        }}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select model, current model ${selectedModel.name}`}
        title={collapsed ? selectedModel.name : undefined}
        className={cn("w-full flex items-center justify-between rounded-xl border transition-colors shadow-sm", collapsed ? "px-2.5 py-2.5 bg-white/10 border-white/15 text-white" : "px-3 py-2.5 bg-surface hover:bg-black/5 border-border-main/50 text-text-main")}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4 shrink-0", collapsed ? "text-cream-highlight" : "text-accent")} />
          {!collapsed && <span className="truncate font-medium">{selectedModel.name}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!collapsed && <div className={cn("w-1.5 h-1.5 rounded-full", getApiKey(selectedModel.id, keys) || customProviders.some((provider) => provider.id === selectedModel.id && provider.requiresApiKey === false) ? "bg-green-500" : "bg-red-400")} />}
          <ChevronDown className={cn("w-4 h-4 transition-transform", collapsed ? "text-cream-highlight" : "text-text-muted", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div role="listbox" aria-label="Available AI models" className="absolute z-20 mt-1.5 w-[min(300px,calc(100vw-2rem))] min-w-full overflow-hidden rounded-xl border border-border-main bg-white py-1 text-text-main shadow-lg">
            {availableModels.map((model) => {
              const ModelIcon = model.icon;
              const hasKey = !!getApiKey(model.id, keys) || customProviders.some((provider) => provider.id === model.id && provider.requiresApiKey === false);
              const modelIndex = availableModels.findIndex((candidate) => candidate.id === model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  tabIndex={activeIndex === modelIndex ? 0 : -1}
                  aria-selected={selected === model.id}
                  ref={(element) => { optionRefs.current[modelIndex] = element; }}
                  onClick={() => {
                    onSelect(model.id);
                    setIsOpen(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveActive(1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveActive(-1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      setActiveIndex(0);
                      optionRefs.current[0]?.focus();
                    } else if (event.key === "End") {
                      event.preventDefault();
                      setActiveIndex(availableModels.length - 1);
                      optionRefs.current[availableModels.length - 1]?.focus();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 text-sm transition-colors group",
                      selected === model.id ? "bg-cream-highlight text-text-main" : "text-slate-800 hover:bg-slate-100"
                  )}
                >
                  <ModelIcon className={cn("w-4 h-4 mt-0.5 shrink-0", selected === model.id ? "text-accent" : "text-slate-500 group-hover:text-slate-900")} />
                  <div className="flex flex-col items-start flex-1 overflow-hidden">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium truncate">{model.name}</span>
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 ml-2", hasKey ? "bg-green-500" : "bg-red-400")} />
                    </div>
                    <span className={cn(
                      "text-[11px] truncate w-full text-left mt-0.5",
                      selected === model.id ? "text-slate-600" : "text-slate-500 group-hover:text-slate-700"
                    )}>
                      {model.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
