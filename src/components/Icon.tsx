// Les icônes proposées pour les groupes et raccourcis. Importées une par une pour que le
// bundle n'embarque pas tout Lucide.
import {
  Activity, Atom, Banknote, Beer, Bike, Bird, Bitcoin, Book, BookOpen, Bookmark, Bot, Brain, Briefcase,
  Bug, Building, Calendar, Camera, Car, Cat, ChartLine, Clock, Cloud, Code, CodeXml, Coffee, Coins, Compass,
  Cpu, Dog, Dumbbell, Earth, Film, Fish, Flag, FlaskConical, Flame, Folder, Gamepad2, Gift, GitBranch, Globe,
  GraduationCap, Hammer, Headphones, Heart, House, Inbox, Key, Landmark, Laptop, Layers, Leaf, Library,
  Lightbulb, Lock, Mail, Map, MapPin, Medal, MessageCircle, Mic, Monitor, Mountain, Music, Newspaper,
  Paintbrush, PawPrint, PenTool, Phone, PiggyBank, Pill, Pizza, Plane, Rocket, Rss, School, Send, Server,
  Shield, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Stethoscope, Store, Sun, Target,
  Terminal, Trees, Trophy, Tv, Umbrella, Users, Utensils, Video, Wallet, Wine, Wrench, Zap,
} from 'lucide-preact';
import type { LucideIcon } from 'lucide-preact';
import type { IconRef } from '../types';

type Comp = LucideIcon;

export const SYMBOLS: Record<string, Comp> = {
  star: Star, heart: Heart, home: House, folder: Folder, bookmark: Bookmark, inbox: Inbox, briefcase: Briefcase,
  code: Code, 'code-xml': CodeXml, terminal: Terminal, server: Server, cpu: Cpu, 'git-branch': GitBranch, bug: Bug,
  bot: Bot, laptop: Laptop, monitor: Monitor, phone: Smartphone, layers: Layers, music: Music, headphones: Headphones,
  mic: Mic, film: Film, tv: Tv, video: Video, gamepad: Gamepad2, camera: Camera, paintbrush: Paintbrush, pen: PenTool,
  sparkles: Sparkles, users: Users, message: MessageCircle, mail: Mail, send: Send, call: Phone, newspaper: Newspaper,
  rss: Rss, book: Book, 'book-open': BookOpen, library: Library, school: School, graduation: GraduationCap,
  lightbulb: Lightbulb, brain: Brain, atom: Atom, flask: FlaskConical, chart: ChartLine, activity: Activity,
  wallet: Wallet, piggy: PiggyBank, coins: Coins, banknote: Banknote, bitcoin: Bitcoin, landmark: Landmark,
  building: Building, store: Store, cart: ShoppingCart, bag: ShoppingBag, gift: Gift, shirt: Shirt,
  plane: Plane, car: Car, bike: Bike, map: Map, pin: MapPin, compass: Compass, earth: Earth, globe: Globe,
  mountain: Mountain, trees: Trees, leaf: Leaf, sun: Sun, cloud: Cloud, umbrella: Umbrella, flame: Flame, zap: Zap,
  coffee: Coffee, utensils: Utensils, pizza: Pizza, wine: Wine, beer: Beer, dumbbell: Dumbbell, trophy: Trophy,
  medal: Medal, target: Target, flag: Flag, rocket: Rocket, stethoscope: Stethoscope, pill: Pill, paw: PawPrint,
  dog: Dog, cat: Cat, fish: Fish, bird: Bird, shield: Shield, lock: Lock, key: Key, hammer: Hammer, wrench: Wrench,
  calendar: Calendar, clock: Clock,
};

export const SYMBOL_NAMES = Object.keys(SYMBOLS);

export function Symbol({ name, size = 18, strokeWidth = 1.8 }: { name: string; size?: number; strokeWidth?: number }) {
  const C = SYMBOLS[name] ?? Folder;
  return <C size={size} strokeWidth={strokeWidth} aria-hidden />;
}

/** Icône de groupe : symbole, emoji ou image importée. */
export function GroupGlyph({ icon, size = 16 }: { icon: IconRef; size?: number }) {
  if (icon.kind === 'emoji') return <span class="glyph-emoji" style={{ fontSize: `${size}px` }} aria-hidden="true">{icon.value}</span>;
  if (icon.kind === 'symbol') return <Symbol name={icon.name} size={size} />;
  return <Symbol name="folder" size={size} />;
}
