import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mail, Lock, User, Building2, Phone, Globe, MapPin, Eye, EyeOff,
  ChevronRight, CheckCircle2, AlertCircle, Search, FileSpreadsheet,
  LogOut, Bell, Send, X, Upload, Clock, ChevronDown, Tag,
  PackageSearch, MessageCircle, ChevronLeft, ShoppingCart,
  Trash2, Download, CreditCard, Shield,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { emailBlocksRegistration, isDeletedUserProfile, reclaimDeletedEmail } from './lib/deleteUser';
import { submitExcelRequest } from './lib/excelRequest';
import { notifyPriceListRequest } from './lib/notifyRequests';
import { notifyRegistrationRequest } from './lib/notifyRegistration';
import { BrandLogoBadge, lookupBrandLogo } from './lib/brandLogo';
import { CatalogQtyInput } from './components/CatalogQtyInput';
import {
  clampQtyInput,
  computeAddQty,
  MAX_STOCK_MESSAGE,
  normalizeSearchTerm,
  searchPartsCatalog,
} from './lib/catalogHelpers';
import { PartStockBadge } from './components/PartStockBadge';
import { accessClientFile, isFileMissingError } from './lib/fileAccess';
import { logUnavailableSearch } from './lib/unavailableSearch';
import { openWhatsApp, partNotFoundWhatsAppMessage } from './lib/openWhatsApp';
import { clearClientCart, loadClientCart, saveClientCart } from './lib/clientCartStorage';
import {
  clientCatalogSourcePattern,
  clientHasActivePriceList,
  shouldHideFromClientRequests,
} from './lib/clientPriceList';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import AdminPanel from './AdminPanel';
import globeLogo from '../public_safe/PAPCO_globe_trimmed.png';
import anniversaryLogo from '../public_safe/PAPCO_55_Anniversary_Logo-01.png';
import publicAutoPartsLogo from '../public/PAPCO_Text_Original_white-02.png';
import kybLogo from '../public/KYB-logo.png';
import totoPistonsLogo from '../public/Toto_Pistons.webp';
import seikenLogo from '../public/seikin.png';
import taihoLogo from '../public/TAIHO.jpg';
import alphasLogo from "../public/ALPHA'S.png";
import tpLogo from '../public/tp-logo-al-shamali.png';
import axcelLogo from '../public/AXCEL.jpeg';
import daidoLogo from '../public/daido_metal.webp';
import rikLogo from '../public/rik.png';
import stoneLogo from '../public/Stone.png';
import torchLogo from '../public/images.png';
import ndcLogo from '../public/JbswVnXlmT32NPrk-original.jpeg';
import musashiLogo from '../public_safe/MUSASHI.png';
import npwLogo from '../public_safe/7sDOZLAoLTcRZ2bh-original.jpeg';
import tamaLogo from '../public_safe/tama.png';
import flammaLogo from '../public_safe/flamma.jpg';
import kyosanLogo from '../public_safe/kyosan.png';
import izumiLogo from '../public/izumi2-280x280.jpg';
import napLogo from '../public/NAP-03.png';
import superTurboLogo from '../public/SUPER_TURBO-04.png';
import axicsLogo from '../public/Copy_of_Posters_(2).png';
import mitsubishiElectricLogo from '../public/Mitsubishi_Electric_logo.png';
import dreikLogo from '../public/New-Project-35-16-1024x1024.webp';
import napcoLogo from '../public/napco-logo-al-shamali.png';
import osakaLogo from '../public/OSAKA.png';
import hktLogo from '../public/hkt-logo-al-shamali.png';
import aisanLogo from '../public/aisan-industry-logo-png_seeklogo-499248.png';
import parautLogo from '../public/paraut-logo-al-shamali.png';
import ficLogo from '../public/fic-logo-al-shamali.png';
import fujiLogo from '../public/unnamed.jpg';
import oskLogo from '../public/TKT008K.webp';
import mitoyoLogo from '../public/MITOYO_ロゴ2019作成.jpg';
import didLogo from '../public/DID_PNG.webp';
import toyoLogo from '../public/TOYOマークカラー大-02.png';
import camelliaLogo from '../public/CAMELLIA.jpg';
import tskLogo from '../public/fWVZxQOdUQ8GD3Ju-original.jpeg';
import shimahideLogo from '../public/SHIMAHIDE-LOGO-1-1024x189.png';
import samLogo from '../public/images_(1).png';
import nittanLogo from '../public/logo2.png';
import rockyLogo from '../public/rocky_engine_valves-logo-al-shamali.png';
import sunLogo from '../public/SUN_UNISOL.png';
import koitoLogo from '../public/7276.T_BIG-e00be6d1.png';
import vicLogo from '../public/VIC-removebg-preview_1_cb763f1f-b61b-4037-adba-980c1456f29b.webp';
import sankeiLogo from '../public/New-Project-32.webp';
import newEraLogo from '../public/New-Project-28-1024x1024.webp';
import mrkLogo from '../public/0d5c9c-main-301455d922e7fb24a715efb146cc9bd9.png';
import seiwaLogo from '../public/images copy copy copy.png';
import elecmanLogo from '../public/ELECMAN.png';
import nkkLogo from '../public/NKK.png';
import teLogo from '../public/TE.png';

type Tab = 'login' | 'register';
type DashboardTab = 'search' | 'pricelist' | 'excel';

interface RegisterForm {
  fullName: string;
  companyName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface LoginForm {
  email: string;
  password: string;
}

interface FieldError {
  [key: string]: string;
}

interface UserProfile {
  full_name: string;
  company_name: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  email: string;
  is_admin?: boolean;
  registration_status?: string;
  rejection_reason?: string | null;
}

interface UserRequest {
  id: string;
  type: string;
  query: string;
  status: string;
  created_at: string;
}

interface PartResult {
  id: string;
  part_number: string;
  brand: string;
  description: string;
  category: string;
  price: number | null;
  stock: number | null;
  coo: string | null;
  extra: Record<string, unknown>;
}

interface CartItem {
  part: PartResult;
  qty: number;
}

// ─── Brand Data ────────────────────────────────────────────────────────────────

interface Brand {
  name: string;
  category: string;
  color: string;
  bg?: string;
  img?: string;
  imgScale?: number;
  noBg?: boolean;
  blendMultiply?: boolean;
}

const ownBrands: Brand[] = [
  { name: 'AXIOS', category: 'BRAKE PADS / BRAKE SHOES', color: '#1a1a1a', bg: '#f5f5f5', img: axicsLogo, imgScale: 1.3 },
  { name: 'AXIOS', category: 'BRAKE DISC / BRAKE DRUM', color: '#1a1a1a', bg: '#f5f5f5', img: axicsLogo, imgScale: 1.3 },
  { name: 'AXCEL', category: 'HYDRAULIC BRAKE & CLUTCH PARTS', color: '#cc1f1f', bg: '#fff', img: axcelLogo },
  { name: 'NAP', category: 'HYDRAULIC BRAKE & CLUTCH PARTS', color: '#1a1f6e', bg: '#fff', img: napLogo },
  { name: 'SUPER TURBO', category: 'STARTER / ALTERNATOR', color: '#cc1f1f', bg: '#fff', img: superTurboLogo, imgScale: 1.3 },
  { name: 'SUPER TURBO', category: 'BATTERY', color: '#cc1f1f', bg: '#fff', img: superTurboLogo, imgScale: 1.3 },
];

const mainBrands: Brand[] = [
  { name: 'KYB', category: 'STEERING & SUSPENSION PARTS', color: '#cc1f1f', bg: '#fff', img: kybLogo },
  { name: 'Toto Pistons', category: 'PISTON SET / CYLINDER LINER', color: '#2d7a2d', bg: '#fff', img: totoPistonsLogo },
  { name: 'Seiken', category: 'HYDRAULIC BRAKE & CLUTCH PARTS', color: '#cc1f1f', bg: '#fff', img: seikenLogo },
  { name: 'TAIHO', category: 'ENGINE BEARING', color: '#cc1f1f', bg: '#fff', img: taihoLogo },
  { name: "ALPHA'S", category: 'ENGINE OIL', color: '#0099e6', bg: '#fff', img: alphasLogo },
  { name: 'TP', category: 'PISTON RING / CYLINDER LINER', color: '#cc1f1f', bg: '#fff', img: tpLogo, imgScale: 1.3 },
  { name: 'NDC', category: 'ENGINE BEARING', color: '#2d7a2d', bg: '#fff', img: ndcLogo },
  { name: 'STONE', category: 'GASKET', color: '#cc1f1f', bg: '#fff', img: stoneLogo, imgScale: 1.3 },
  { name: 'DAIDO METAL', category: 'ENGINE BEARING', color: '#1a1f6e', bg: '#fff', img: daidoLogo },
  { name: 'RIK', category: 'PISTON RING', color: '#cc1f1f', bg: '#fff', img: rikLogo, imgScale: 1.3 },
  { name: 'TORCH', category: 'SPARK PLUG / IGNITION COIL', color: '#1a1f6e', bg: '#fff', img: torchLogo },
];

const partnerBrands: Brand[] = [
  { name: 'MUSASHI', category: 'OIL SEAL', color: '#cc1f1f', bg: '#fff', img: musashiLogo, imgScale: 1.3 },
  { name: 'IZUMI', category: 'TIMING CHAIN', color: '#e85d04', bg: '#fff', img: izumiLogo },
  { name: 'NPW', category: 'WATER PUMP / FAN CLUTCH', color: '#cc1f1f', bg: '#fff', img: npwLogo, imgScale: 1.3 },
  { name: 'TAMA', category: 'THERMOSTAT', color: '#1a1f6e', bg: '#fff', img: tamaLogo, imgScale: 1.3 },
  { name: 'FLAMMA', category: 'IGNITION COIL', color: '#cc1f1f', bg: '#fff', img: flammaLogo },
  { name: 'KYOSAN', category: 'FUEL PUMP', color: '#1a1f6e', bg: '#fff', img: kyosanLogo },
  { name: 'MITSUBISHI ELECTRIC', category: 'ELECTRICAL PARTS', color: '#cc1f1f', bg: '#fff', img: mitsubishiElectricLogo },
  { name: 'DREIK', category: 'ELECTRICAL PARTS', color: '#e85d04', bg: '#fff', img: dreikLogo },
  { name: 'MRK', category: 'CLUTCH BEARING / KINGPIN KIT', color: '#cc1f1f', bg: '#fff', img: mrkLogo },
  { name: 'SEIWA', category: 'PLUG WIRE SET', color: '#cc1f1f', bg: '#fff', img: seiwaLogo },
  { name: 'OSAKA NUT', category: 'BOLTS AND NUTS', color: '#1a1a1a', bg: '#fff', img: osakaLogo },
  { name: 'NAPCO', category: 'CARBURETOR REPAIR KIT', color: '#cc1f1f', bg: '#fff', img: napcoLogo },
  { name: 'HKT', category: 'FUEL PUMP / GLOW PLUGS', color: '#cc1f1f', bg: '#fff', img: hktLogo },
  { name: 'AISAN', category: 'ELECTRICAL PARTS', color: '#cc1f1f', bg: '#fff', img: aisanLogo },
  { name: 'FUJI', category: 'ENGINE VALVE', color: '#cc1f1f', bg: '#fff', img: fujiLogo },
  { name: 'PARAUT', category: 'FAN COUPLING', color: '#1a6ebf', bg: '#fff', img: parautLogo },
  { name: 'FIC', category: 'HYDRAULIC BRAKE & CLUTCH PARTS', color: '#cc1f1f', bg: '#fff', img: ficLogo },
  { name: 'MITOYO', category: 'OIL PUMP', color: '#cc1f1f', bg: '#fff', img: mitoyoLogo },
  { name: 'OSK', category: 'CHAIN TENSIONER, ROLLER CHAIN', color: '#00bcd4', bg: '#fff', img: oskLogo },
  { name: 'D.I.D', category: 'TIMING CHAIN', color: '#cc1f1f', bg: '#fff', img: didLogo },
  { name: 'CAMELLIA', category: 'CHAIN TENSIONER, TIMING CHAIN', color: '#2d7a2d', bg: '#fff', img: camelliaLogo },
  { name: 'TOYO', category: 'UNIVERSAL JOINT', color: '#cc1f1f', bg: '#fff', img: toyoLogo },
  { name: 'TSK', category: 'CABLES', color: '#1a4dbf', bg: '#fff', img: tskLogo },
  { name: 'SAM', category: 'HYDRAULIC BRAKE & CLUTCH PARTS', color: '#cc1f1f', bg: '#fff', img: samLogo },
  { name: 'Shimahide', category: 'FAN CLUTCH', color: '#cc1f1f', bg: '#fff', img: shimahideLogo },
  { name: 'NITTAN', category: 'ENGINE VALVE', color: '#0d2a5e', bg: '#fff', img: nittanLogo },
  { name: 'SUN UNISOL', category: 'TIMING BELT', color: '#1a6ea8', bg: '#fff', img: sunLogo },
  { name: 'KOITO', category: 'BULB', color: '#cc1f1f', bg: '#fff', img: koitoLogo },
  { name: 'ROCKY', category: 'HYDRAULIC BRAKE & CLUTCH PARTS', color: '#2a7abf', bg: '#fff', img: rockyLogo },
  { name: 'ROCKY', category: 'ENGINE VALVE', color: '#2a7abf', bg: '#fff', img: rockyLogo },
  { name: 'NKK', category: 'CLUTCH DISC & CLUTCH COVER', color: '#c8a000', bg: '#fff', img: nkkLogo },
  { name: 'TE', category: 'RUBBER BUSHES', color: '#cc1f1f', bg: '#fff', img: teLogo },
  { name: 'New-Era', category: 'ELECTRICAL PARTS', color: '#cc1f1f', bg: '#fff', img: newEraLogo },
  { name: 'SANKEI', category: 'ELECTRICAL PARTS', color: '#1a1fbf', bg: '#fff', img: sankeiLogo },
  { name: 'VIC', category: 'FILTERS', color: '#cc1f1f', bg: '#fff', img: vicLogo },
  { name: 'ELECMAN', category: 'IN-TANK FUEL PUMP', color: '#cc1f1f', bg: '#fff', img: elecmanLogo },
];


// ─── Brand Card ────────────────────────────────────────────────────────────────

function BrandCard({
  brand, isHovered, anyHovered, onEnter, onLeave,
}: {
  brand: Brand; isHovered: boolean; anyHovered: boolean; onEnter: () => void; onLeave: () => void;
}) {
  const dimmed = anyHovered && !isHovered;
  const cardBg = brand.noBg ? 'transparent' : (brand.bg ?? '#fff');
  return (
    <div
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      onTouchStart={onEnter} onTouchEnd={onLeave}
      className="relative flex flex-col items-center gap-1.5 cursor-default select-none"
      style={{
        opacity: dimmed ? 0.35 : 1,
        transform: isHovered ? 'scale(1.04) translateY(-2px)' : 'scale(1) translateY(0)',
        zIndex: isHovered ? 30 : 1,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        willChange: 'transform, opacity',
      }}
    >
      <div
        className="relative flex items-center justify-center rounded-xl w-[132px] h-[80px] px-2.5 overflow-hidden shrink-0"
        style={brand.noBg ? {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        } : {
          background: cardBg,
          border: isHovered ? `1.5px solid ${brand.color}60` : '1.5px solid #e2e6ea',
          boxShadow: isHovered
            ? `0 6px 24px ${brand.color}25, 0 2px 8px rgba(0,0,0,0.08)`
            : '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'border 0.25s ease, box-shadow 0.25s ease, background 0.25s ease',
        }}
      >
        {brand.img ? (
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden"
            style={{ background: cardBg }}
          >
            <img
              src={brand.img}
              alt={brand.name}
              draggable={false}
              className="block max-w-full max-h-full object-contain"
              style={{
                transform: brand.imgScale ? `scale(${brand.imgScale})` : undefined,
                mixBlendMode: brand.blendMultiply ? 'multiply' : undefined,
                transition: 'transform 0.25s ease',
              }}
            />
          </div>
        ) : (
          <span
            className="font-black text-center leading-tight"
            style={{
              color: brand.color,
              fontSize: brand.name.length > 10 ? '11px' : brand.name.length > 7 ? '13px' : '15px',
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              letterSpacing: '-0.01em',
              filter: isHovered ? `drop-shadow(0 1px 3px ${brand.color}50)` : 'none',
              transition: 'filter 0.25s ease',
            }}
          >
            {brand.name}
          </span>
        )}
      </div>
      <span
        className="text-center font-medium leading-tight w-[132px]"
        style={{
          color: isHovered ? '#1a1f6e' : '#6b7280',
          fontSize: '9px',
          letterSpacing: '0.02em',
          transition: 'color 0.25s ease',
        }}
      >
        {brand.category}
      </span>
    </div>
  );
}

function SectionHeaderBar({ title }: { title: string }) {
  return (
    <div
      className="w-full flex items-center justify-center py-3 px-6 mb-5 rounded-lg"
      style={{
        background: 'linear-gradient(90deg, #1a1f6e 0%, #252d8a 50%, #1a1f6e 100%)',
        borderLeft: '4px solid #cc1f1f',
        borderRight: '4px solid #cc1f1f',
      }}
    >
      <h3 className="text-white font-black text-xl tracking-wide uppercase"
        style={{ fontFamily: "'Arial Black', 'Arial', sans-serif", letterSpacing: '0.08em' }}>
        {title}
      </h3>
    </div>
  );
}

function BrandSection({ title, brands }: { title: string; brands: Brand[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  return (
    <div className="mb-8">
      <SectionHeaderBar title={title} />
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 px-2" style={{ isolation: 'isolate' }}>
        {brands.map((brand, i) => (
          <BrandCard
            key={`${brand.name}-${i}`} brand={brand}
            isHovered={hoveredIdx === i} anyHovered={hoveredIdx !== null}
            onEnter={() => setHoveredIdx(i)} onLeave={() => setHoveredIdx(null)}
          />
        ))}
      </div>
    </div>
  );
}

function BrandsShowcase() {
  return (
    <section
      className="relative py-8 px-4"
      style={{
        background: 'linear-gradient(180deg, #f0f2f8 0%, #e8ebf5 100%)',
        borderTop: '3px solid #cc1f1f',
        borderBottom: '3px solid #cc1f1f',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231a1f6e' fill-opacity='1'%3E%3Ccircle cx='40' cy='40' r='30' stroke='%231a1f6e' stroke-width='4' fill='none'/%3E%3Ccircle cx='40' cy='40' r='18' stroke='%231a1f6e' stroke-width='4' fill='none'/%3E%3Ccircle cx='40' cy='40' r='7'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="relative max-w-5xl mx-auto">
        <BrandSection title="Own Brands" brands={ownBrands} />
        <BrandSection title="Main Brands" brands={mainBrands} />
        <BrandSection title="Partner Brands" brands={partnerBrands} />

        <div
          className="mt-2 py-3 px-6 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-semibold"
          style={{ background: '#1a1f6e', color: '#fff' }}
        >
          <span>Website: <span className="text-red-300">www.papco-uae.com</span></span>
          <span>Email: <span className="text-red-300">sales@papco-uae.com</span></span>
        </div>
      </div>
    </section>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

const headerLogos = [
  { src: globeLogo, alt: 'PAPCO Globe Logo', label: 'Public Auto Parts Co. LLC' },
  { src: anniversaryLogo, alt: 'PAPCO 55th Anniversary', label: '55th Anniversary Edition' },
];

function LogoCard({ logo, hovered, index, onEnter, onLeave }: {
  logo: { src: string; alt: string; label: string };
  hovered: number | null; index: number; onEnter: () => void; onLeave: () => void;
}) {
  const active = hovered === index;
  return (
    <div
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      className="relative flex flex-col items-center gap-3 cursor-default"
      style={{
        opacity: hovered === null ? 1 : active ? 1 : 0.35,
        transform: active ? 'scale(1.06) translateY(-4px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          boxShadow: active ? '0 0 40px 4px rgba(204,31,31,0.25), 0 0 70px 8px rgba(26,31,110,0.15)' : 'none',
          transition: 'box-shadow 0.35s ease',
        }}
      />
      <div
        className="relative flex items-center justify-center rounded-2xl overflow-hidden"
        style={{
          width: '200px',
          height: '170px',
          background: active ? 'linear-gradient(145deg, #f8f9ff, #fff5f5)' : '#ffffff',
          border: active ? '1px solid rgba(204,31,31,0.2)' : '1px solid rgba(0,0,0,0.07)',
          transition: 'background 0.35s ease, border 0.35s ease',
          padding: '16px',
        }}
      >
        <img
          src={logo.src}
          alt={logo.alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: active ? 'drop-shadow(0 4px 14px rgba(204,31,31,0.35)) brightness(1.06)' : 'brightness(1)',
            transition: 'filter 0.35s ease',
          }}
        />
      </div>
      <span
        className="text-center text-xs font-medium tracking-wide max-w-[180px]"
        style={{ color: active ? '#1a1f6e' : '#9ca3af', transition: 'color 0.35s ease' }}
      >
        {logo.label}
      </span>
    </div>
  );
}

function LogoShowcase({ user, profile, onSignOut }: {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  onSignOut: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <header className="relative overflow-hidden bg-white border-b border-gray-100">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-papco-navy via-papco-red to-papco-navy" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 items-center sm:items-start gap-6 sm:gap-4">
          <div className="flex justify-center sm:justify-start">
            <LogoCard logo={headerLogos[0]} hovered={hovered} index={0} onEnter={() => setHovered(0)} onLeave={() => setHovered(null)} />
          </div>
          <div className="flex justify-center order-first sm:order-none">
            <div className="bg-white rounded-lg overflow-hidden px-3 py-2 max-w-full">
              <img src={publicAutoPartsLogo} alt="Public Auto Parts Co. LLC"
                className="w-full max-w-[260px] h-auto max-h-[100px] sm:max-h-[120px] object-contain mx-auto"
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>
          </div>
          <div className="flex justify-center sm:justify-end flex-col items-center sm:items-end gap-3">
            <LogoCard logo={headerLogos[1]} hovered={hovered} index={1} onEnter={() => setHovered(1)} onLeave={() => setHovered(null)} />
            {user && (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-papco-navy leading-tight">{profile?.full_name || user.email}</p>
                  <p className="text-xs text-gray-400">{profile?.company_name}</p>
                </div>
                {/* Home button only shown on homepage (not in dashboard — dashboard has its own) */}
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-papco-navy hover:bg-papco-navy-dark transition-colors"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-papco-navy via-papco-red to-papco-navy" />
    </header>
  );
}

// ─── Input Field ───────────────────────────────────────────────────────────────

function InputField({
  icon: Icon, label, type = 'text', value, onChange, error, placeholder, rightElement,
}: {
  icon: React.ElementType; label: string; type?: string; value: string;
  onChange: (v: string) => void; error?: string; placeholder?: string; rightElement?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon size={16} /></span>
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full pl-9 ${rightElement ? 'pr-10' : 'pr-3'} py-2.5 text-sm rounded-lg border bg-white transition-all duration-200 outline-none
            focus:ring-2 focus:ring-papco-red/30 focus:border-papco-red
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
        />
        {rightElement && <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Toast Notification ────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = {
    success: <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />,
    error: <AlertCircle size={16} className="text-red-500 flex-shrink-0" />,
    info: <Bell size={16} className="text-blue-500 flex-shrink-0" />,
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl max-w-sm text-sm font-medium
        ${colors[type]}`}
      style={{ animation: 'slideInUp 0.3s ease' }}
    >
      {icons[type]}
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Register Section ──────────────────────────────────────────────────────────

function registrationErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/already registered|user_already_exists/i.test(msg)) {
    return 'An account with this email already exists.';
  }
  if (/rate limit|too many/i.test(msg)) {
    return 'Too many registration attempts. Please wait a few minutes and try again.';
  }
  if (/invalid email|unable to validate email/i.test(msg)) {
    return 'This email address could not be accepted. Please check the spelling or try again later.';
  }
  if (/profiles.*does not exist|schema cache/i.test(msg)) {
    return 'Registration is temporarily unavailable. Please contact the administrator.';
  }
  return msg || 'Registration failed. Please try again.';
}

function RegisterSection({
  onSwitchToLogin,
  initialEmail = '',
}: {
  onSwitchToLogin: () => void;
  initialEmail?: string;
}) {
  const [form, setForm] = useState<RegisterForm>({
    fullName: '', companyName: '', phone: '', country: '', city: '',
    address: '', email: initialEmail, password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!initialEmail) return;
    const normalized = initialEmail.toLowerCase().trim();
    setForm(f => ({ ...f, email: normalized }));
    void reclaimDeletedEmail(normalized);
  }, [initialEmail]);

  const set = (field: keyof RegisterForm) => (value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
    if (serverError) setServerError('');
  };

  const validate = (): boolean => {
    const errs: FieldError = {};
    if (!form.fullName.trim()) errs.fullName = 'Required';
    if (!form.companyName.trim()) errs.companyName = 'Required';
    if (!form.phone.trim()) errs.phone = 'Required';
    if (!form.country.trim()) errs.country = 'Required';
    if (!form.city.trim()) errs.city = 'Required';
    if (!form.email.trim()) {
      errs.email = 'Required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email address';
    }
    if (!form.password) {
      errs.password = 'Required';
    } else if (form.password.length < 6) {
      errs.password = 'Minimum 6 characters';
    }
    if (!form.confirmPassword) {
      errs.confirmPassword = 'Required';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      const normalizedEmail = form.email.toLowerCase().trim();

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email?.toLowerCase().trim() === normalizedEmail) {
        await supabase.auth.signOut();
      }

      await reclaimDeletedEmail(normalizedEmail);

      if (await emailBlocksRegistration(normalizedEmail)) {
        setServerError('An account with this email already exists.');
        return;
      }

      let { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });

      if (error && /already registered|user_already_exists/i.test(error.message)) {
        await reclaimDeletedEmail(normalizedEmail);
        const retry = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
        });
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      if (data.user) {
        const registeredAt = new Date().toISOString();
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: form.fullName.trim(),
          company_name: form.companyName.trim(),
          phone: form.phone.trim(),
          country: form.country.trim(),
          city: form.city.trim(),
          address: form.address.trim(),
          email: form.email.toLowerCase().trim(),
          registration_status: 'pending',
        });
        if (profileError) throw profileError;

        await notifyRegistrationRequest({
          userId: data.user.id,
          fullName: form.fullName.trim(),
          companyName: form.companyName.trim(),
          phone: form.phone.trim(),
          country: form.country.trim(),
          city: form.city.trim(),
          address: form.address.trim(),
          email: form.email.toLowerCase().trim(),
          registeredAt,
        });

        // Sign out immediately — no access until approved
        await supabase.auth.signOut();
      }

      setSuccess(true);
    } catch (err: unknown) {
      setServerError(registrationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-6 text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={44} className="text-green-600" />
          </div>
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center border-2 border-white">
            <Clock size={16} className="text-amber-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-gray-900">Application Submitted!</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">Your registration request has been received and is now pending review.</p>
        </div>
        <div className="w-full max-w-sm p-4 rounded-xl text-left space-y-2"
          style={{ background: 'linear-gradient(135deg, #fffbeb, #fff9f0)', border: '1px solid #fde68a' }}>
          <div className="flex items-center gap-2 mb-2">
            <Bell size={15} className="text-amber-500" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">What happens next?</span>
          </div>
          {[
            'The administrator will review your application',
            'You will receive an email once your account is approved',
            'After approval, sign in with your email and password',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-amber-800 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
        <button onClick={onSwitchToLogin}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-semibold hover:bg-papco-navy-dark transition-colors">
          Go to Sign In <ChevronRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{serverError}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField icon={User} label="Full Name *" value={form.fullName} onChange={set('fullName')} error={errors.fullName} placeholder="John Smith" />
        <InputField icon={Building2} label="Company Name *" value={form.companyName} onChange={set('companyName')} error={errors.companyName} placeholder="ACME Corp." />
      </div>
      <InputField icon={Phone} label="Phone Number *" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="+971 50 000 0000" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField icon={Globe} label="Country *" value={form.country} onChange={set('country')} error={errors.country} placeholder="United Arab Emirates" />
        <InputField icon={MapPin} label="City *" value={form.city} onChange={set('city')} error={errors.city} placeholder="Dubai" />
      </div>
      <InputField icon={Mail} label="Email / Login *" type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="you@company.com" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField icon={Lock} label="Password *" type={showPass ? 'text' : 'password'}
          value={form.password} onChange={set('password')} error={errors.password} placeholder="Min. 6 characters"
          rightElement={
            <button type="button" onClick={() => setShowPass(v => !v)} className="text-gray-400 hover:text-papco-navy transition-colors">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        <InputField icon={Lock} label="Confirm Password *" type={showConfirm ? 'text' : 'password'}
          value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} placeholder="Repeat password"
          rightElement={
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="text-gray-400 hover:text-papco-navy transition-colors">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
      </div>
      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white text-sm
          bg-papco-red hover:bg-papco-red-dark active:scale-[0.98] transition-all duration-200
          shadow-lg shadow-papco-red/25 disabled:opacity-60 disabled:cursor-not-allowed mt-1">
        {loading
          ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><Send size={15} /> Submit Application</>}
      </button>
      <p className="text-xs text-gray-400 text-center">
        After submitting, your account will be reviewed by the administrator before access is granted.
      </p>
    </form>
  );
}

// ─── Login Section ─────────────────────────────────────────────────────────────

type LoginStatus = 'idle' | 'pending' | 'rejected';

function LoginSection() {
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');
  const [rejectionReason, setRejectionReason] = useState('');
  const [serverError, setServerError] = useState('');

  const set = (field: keyof LoginForm) => (value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
    setLoginStatus('idle');
    if (serverError) setServerError('');
  };

  const validate = (): boolean => {
    const errs: FieldError = {};
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.password) errs.password = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    setLoginStatus('idle');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('registration_status, is_admin, rejection_reason')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile && !profile.is_admin && profile.registration_status !== 'approved') {
          await supabase.auth.signOut();
          if (profile.registration_status === 'rejected') {
            setLoginStatus('rejected');
            setRejectionReason(profile.rejection_reason || '');
          } else {
            setLoginStatus('pending');
          }
        }
        // If approved (or admin) — auth state change in App will redirect automatically
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Pending notice */}
      {loginStatus === 'pending' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <Clock size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Account not yet confirmed</p>
            <p className="text-amber-700 mt-0.5 leading-relaxed">
              Your account is awaiting administrator approval. You will receive an email notification once confirmed.
            </p>
          </div>
        </div>
      )}

      {/* Rejected notice */}
      {loginStatus === 'rejected' && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Registration declined</p>
            <p className="text-red-700 mt-0.5 leading-relaxed">
              Your registration was declined by the administrator.
              {rejectionReason && <> Reason: <em>{rejectionReason}</em>.</>}
            </p>
            <a href="mailto:sales@papco-uae.com" className="text-xs text-red-600 underline mt-1 inline-block">
              Contact us: sales@papco-uae.com
            </a>
          </div>
        </div>
      )}

      {/* Generic server error */}
      {serverError && loginStatus === 'idle' && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{serverError}</span>
        </div>
      )}

      <InputField icon={Mail} label="Email / Login" type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="you@company.com" />
      <InputField icon={Lock} label="Password" type={showPass ? 'text' : 'password'}
        value={form.password} onChange={set('password')} error={errors.password} placeholder="Enter your password"
        rightElement={
          <button type="button" onClick={() => setShowPass(v => !v)} className="text-gray-400 hover:text-papco-navy transition-colors">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white text-sm
          bg-papco-navy hover:bg-papco-navy-dark active:scale-[0.98] transition-all duration-200
          shadow-lg shadow-papco-navy/25 disabled:opacity-60 disabled:cursor-not-allowed">
        {loading
          ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <>Sign In <ChevronRight size={16} /></>}
      </button>
    </form>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function AdminFileRow({ file, onDelete }: { file: AdminFile; onDelete?: (id: string) => void }) {
  const [downloading, setDownloading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const formatFileErr = (e: unknown, fallback: string) => {
    if (e instanceof Error && e.message && e.message !== '{}') return e.message;
    return fallback;
  };

  const handleDownload = async () => {
    setDownloading(true);
    setFileError(null);
    try {
      await accessClientFile(file, 'download');
    } catch (e) {
      setFileError(formatFileErr(e, 'Download failed'));
    } finally {
      setDownloading(false);
    }
  };

  const sizeKb = (file.file_size / 1024).toFixed(0);

  return (
    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileSpreadsheet size={15} className="text-green-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-xs truncate">{file.filename}</p>
            <p className="text-xs text-gray-400">{sizeKb} KB · {new Date(file.uploaded_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
            {downloading
              ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              : <Download size={12} />}
            Download
          </button>
          {onDelete && (
            <button onClick={() => onDelete(file.id)}
              className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {fileError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 space-y-1.5">
          <p>{fileError}</p>
          {isFileMissingError(fileError) && onDelete && (
            <button
              type="button"
              onClick={() => { setFileError(null); onDelete(file.id); }}
              className="font-semibold underline hover:text-red-800"
            >
              Удалить эту запись
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RequestHistory({ requests, onDelete, onClearAll }: {
  requests: UserRequest[];
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
}) {
  const typeLabels: Record<string, string> = {
    catalog_search: 'Catalog Search',
    catalog_request: 'Catalog Request',
    excel_request: 'Excel Request',
    pricelist_request: 'Price List Request',
    admin_file: 'File from PAPCO',
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <Clock size={32} className="mx-auto mb-2 opacity-30" />
        No requests sent yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {onClearAll && requests.length > 0 && (
        <div className="flex justify-end mb-1">
          <button onClick={onClearAll}
            className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
            <Trash2 size={12} /> Clear All
          </button>
        </div>
      )}
      {requests.map(req => (
        <div key={req.id}
          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm"
        >
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-papco-navy text-xs">{typeLabels[req.type] || req.type}</span>
            {req.query && <p className="text-gray-500 text-xs truncate mt-0.5">{req.query}</p>}
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {req.status === 'processed' ? 'Processed' : 'Pending'}
            </span>
            <span className="text-xs text-gray-400 hidden sm:inline">
              {new Date(req.created_at).toLocaleDateString()}
            </span>
            {onDelete && (
              <button onClick={() => onDelete(req.id)}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Currency helpers ──────────────────────────────────────────────────────────

const USD_TO_AED = 3.65;

function convertPrice(priceAed: number | null, currency: 'AED' | 'USD'): string {
  if (priceAed == null) return '—';
  if (currency === 'AED') return `${priceAed.toFixed(2)} AED`;
  return `$${(priceAed / USD_TO_AED).toFixed(2)}`;
}

// ─── Excel export helper ───────────────────────────────────────────────────────

async function exportCartToExcel(items: CartItem[], filename: string, currency: 'AED' | 'USD') {
  const XLSX = await import('xlsx-js-style');
  const sym = currency === 'AED' ? 'AED' : 'USD';

  const total = items.reduce((sum, item) => {
    if (item.part.price == null) return sum;
    return sum + (currency === 'AED' ? item.part.price : item.part.price / USD_TO_AED) * item.qty;
  }, 0);

  const border = {
    top:    { style: 'thin', color: { rgb: 'C5CAE8' } },
    bottom: { style: 'thin', color: { rgb: 'C5CAE8' } },
    left:   { style: 'thin', color: { rgb: 'C5CAE8' } },
    right:  { style: 'thin', color: { rgb: 'C5CAE8' } },
  };

  const hStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { patternType: 'solid', fgColor: { rgb: '1A1F6E' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border,
  };

  const COLS = 6;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: any = {};

  const headers = ['Part Number', 'Brand', 'Description', `Price (${sym})`, 'Qty', `Total (${sym})`];
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: h, t: 's', s: hStyle };
  });

  items.forEach((item, i) => {
    const r = i + 1;
    const bg = r % 2 === 0 ? 'E8EBF5' : 'FFFFFF';
    const st = {
      font: { sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border,
    };
    const unitPrice = item.part.price != null
      ? +(currency === 'AED' ? item.part.price : item.part.price / USD_TO_AED).toFixed(2)
      : null;
    const rowTotal = unitPrice != null ? +(unitPrice * item.qty).toFixed(2) : null;
    const vals: (string | number)[] = [
      item.part.part_number, item.part.brand || '', item.part.description || '',
      unitPrice ?? '', item.qty, rowTotal ?? '',
    ];
    vals.forEach((v, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = {
        v, t: typeof v === 'number' ? 'n' : 's',
        z: (c === 3 || c === 5) && typeof v === 'number' ? '#,##0.00' : undefined,
        s: st,
      };
    });
  });

  const taxAmount = +(total * 0.05).toFixed(2);
  const grandTotal = +(total + taxAmount).toFixed(2);

  const taxR = items.length + 1;
  const grandR = items.length + 2;

  const taxSt = {
    font: { bold: true, sz: 11, color: { rgb: 'CC1F1F' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFE8E8' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border,
  };
  const grandSt = {
    font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '1A1F6E' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border,
  };

  const summaryRows: { r: number; label: string; value: number; style: typeof taxSt }[] = [
    { r: taxR, label: 'TAX (+5%)', value: taxAmount, style: taxSt },
    { r: grandR, label: 'TOTAL (incl. TAX)', value: grandTotal, style: grandSt },
  ];

  ws['!merges'] = [];
  for (const { r, label, value, style } of summaryRows) {
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: COLS - 2 } });
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
      v: label,
      t: 's',
      s: {
        ...style,
        alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
      },
    };
    ws[XLSX.utils.encode_cell({ r, c: COLS - 1 })] = {
      v: value,
      t: 'n',
      z: '#,##0.00',
      s: style,
    };
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: grandR, c: COLS - 1 } });
  ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 8 }, { wch: 18 }];
  ws['!rows'] = Array.from({ length: grandR + 1 }, (_, i) => ({
    hpt: i === 0 ? 22 : i === grandR ? 26 : i >= taxR ? 22 : 18,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Order');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/\.(xlsx|csv|xls)$/i, '')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Catalog Search Tab ────────────────────────────────────────────────────────

function CatalogSearchTab({ user, profile }: { user: SupabaseUser; profile: UserProfile | null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cart state (persisted per client until they clear the cart)
  const [cart, setCart] = useState<CartItem[]>(() => loadClientCart(user.id) as CartItem[]);
  const [cartQtyDrafts, setCartQtyDrafts] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);
  const [currency, setCurrency] = useState<'AED' | 'USD'>('AED');

  useEffect(() => {
    setCart(loadClientCart(user.id) as CartItem[]);
  }, [user.id]);

  useEffect(() => {
    saveClientCart(user.id, cart);
  }, [user.id, cart]);

  const clearCart = () => {
    setCart([]);
    clearClientCart(user.id);
  };

  // Qty inputs for each search result card (partId -> qty string)
  const [cardQtys, setCardQtys] = useState<Record<string, string>>({});

  // Not-found WhatsApp modal
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [notFoundQty, setNotFoundQty] = useState('1');
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');

  // Excel export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');

  // Pay modal
  const [showPayModal, setShowPayModal] = useState(false);

  const refreshCatalogState = useCallback(async () => {
    const hasList = await clientHasActivePriceList(user.id);
    let count = 0;
    if (hasList) {
      const { count: clientCount } = await supabase
        .from('parts_catalog')
        .select('id', { count: 'exact', head: true })
        .filter('source_file', 'ilike', clientCatalogSourcePattern(user.id));
      count = clientCount ?? 0;
    } else {
      const { data: generalRows } = await supabase
        .from('parts_catalog')
        .select('id, source_file')
        .limit(5000);
      count = (generalRows ?? []).filter(r => !r.source_file?.startsWith('client:')).length;
    }
    setCatalogEmpty(count === 0);
    return hasList;
  }, [user.id]);

  useEffect(() => {
    refreshCatalogState();
  }, [refreshCatalogState]);

  useEffect(() => {
    const onFocus = () => { refreshCatalogState(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshCatalogState]);

  const doSearch = useCallback(async (q: string) => {
    const term = normalizeSearchTerm(q);
    if (!term) return;
    setSearching(true);
    setSearched(false);
    try {
      setLastSearchedQuery(term);
      const hasList = await clientHasActivePriceList(user.id);
      const scope = hasList
        ? { mode: 'client' as const, userId: user.id }
        : { mode: 'general' as const };
      const { data, error } = await searchPartsCatalog(term, 100, scope);
      if (error) {
        setToast({ message: `Search error: ${error}`, type: 'error' });
        setResults([]);
        return;
      }
      const found = data ?? [];
      setResults(found);
      if (found.length === 0) {
        const log = await logUnavailableSearch(user, profile, term);
        if (!log.ok) {
          setToast({ message: `Could not save to Unavailable Parts: ${log.error}`, type: 'error' });
        }
        setNotFoundQty('1');
        setShowNotFoundModal(true);
      }
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [user.id, profile]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSearch(query);
  };

  const addToCart = (part: PartResult, qty = 1) => {
    const existing = cart.find(i => i.part.id === part.id);
    const { qty: newQty, blocked, atMax, max } = computeAddQty(
      part.stock,
      existing?.qty ?? 0,
      qty,
    );
    if (blocked || newQty < 1) {
      setToast({
        message: max === 0 ? 'Товар отсутствует на складе' : MAX_STOCK_MESSAGE(max as number),
        type: 'error',
      });
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.part.id === part.id);
      if (ex) {
        return prev.map(i => (i.part.id === part.id ? { ...i, qty: newQty } : i));
      }
      return [...prev, { part, qty: newQty }];
    });
    if (atMax && max !== Infinity) {
      setToast({ message: MAX_STOCK_MESSAGE(max as number), type: 'info' });
    } else {
      setToast({ message: `${part.part_number} добавлен в корзину`, type: 'success' });
    }
  };

  const setCartItemQty = (partId: string, qty: number) => {
    setCart(prev => prev.map(i => {
      if (i.part.id !== partId) return i;
      const maxQty = i.part.stock != null ? i.part.stock : Infinity;
      const clamped = Math.min(Math.max(Math.floor(qty), 1), maxQty);
      return { ...i, qty: clamped };
    }));
  };

  const removeFromCart = (partId: string) => {
    setCart(prev => prev.filter(i => i.part.id !== partId));
    setCartQtyDrafts(prev => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
  };

  const cartTotal = cart.reduce((sum, item) => {
    if (item.part.price == null) return sum;
    const unitPrice = currency === 'AED' ? item.part.price : item.part.price / USD_TO_AED;
    return sum + unitPrice * item.qty;
  }, 0);
  const cartTax = cartTotal * 0.05;
  const cartAmount = cartTotal + cartTax;

  const handleExport = async () => {
    const name = exportFilename.trim() || 'PAPCO_Cart';
    await exportCartToExcel(cart, name, currency);
    setShowExportModal(false);
    setExportFilename('');
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="p-5 sm:p-7 space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-papco-navy/10 flex items-center justify-center flex-shrink-0">
            <PackageSearch size={20} className="text-papco-navy" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-papco-navy">Search</h2>
            <p className="text-xs text-gray-500">Search by part number, brand number, engine number, category or description</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          {/* Currency toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['AED', 'USD'] as const).map(c => (
              <button key={c} type="button" onClick={() => setCurrency(c)}
                className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-md text-xs font-bold transition-all touch-manipulation
                  ${currency === c ? 'bg-white text-papco-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {c}
              </button>
            ))}
          </div>
          {/* Cart button */}
          <button type="button" onClick={() => setShowCart(true)}
            className="relative flex flex-1 sm:flex-initial items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-papco-navy text-white text-xs font-semibold hover:bg-papco-navy-dark transition-colors shadow-md touch-manipulation">
            <ShoppingCart size={15} />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-papco-red text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {catalogEmpty && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800">The catalog is currently empty. The administrator will upload parts data soon.</p>
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={query}
            onChange={e => { setQuery(e.target.value); if (searched) setSearched(false); }}
            placeholder="Code, brand, name, category…"
            className="w-full pl-9 pr-4 py-3 text-base sm:text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
              focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy focus:bg-white transition-all" />
        </div>
        <button type="submit" disabled={searching || !query.trim()}
          className="flex items-center justify-center gap-2 min-h-[48px] w-full sm:w-auto px-5 py-3 rounded-xl font-semibold text-white text-sm
            bg-papco-navy hover:bg-papco-navy-dark active:scale-[0.98] transition-all touch-manipulation
            shadow-lg shadow-papco-navy/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
          {searching ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={15} />}
          Search
        </button>
      </form>

      {/* Searching spinner */}
      {searching && (
        <div className="flex items-center justify-center py-10 gap-3 text-gray-400 text-sm">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-papco-navy rounded-full animate-spin" />
          Searching catalog…
        </div>
      )}

      {/* Results */}
      {searched && !searching && (
        results.length === 0 ? (
          <div className="text-center py-10 space-y-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <PackageSearch size={26} className="text-gray-400" />
            </div>
            <div>
              <p className="font-bold text-gray-700">Part not found</p>
              <p className="text-sm text-gray-400 mt-1">
                "<em className="text-papco-navy font-semibold not-italic">{lastSearchedQuery}</em>" is not in the catalog yet.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => openWhatsApp(partNotFoundWhatsAppMessage(lastSearchedQuery, notFoundQty || '1'))}
                className="flex items-center justify-center gap-2 min-h-[48px] w-full sm:w-auto px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors shadow-sm touch-manipulation">
                <MessageCircle size={14} /> Send Request via WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium">
              {results.length} result{results.length !== 1 ? 's' : ''} for "<em>{query}</em>"
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map(part => {
                const inCart = cart.some(i => i.part.id === part.id);
                const cardQty = cardQtys[part.id] ?? '';
                const maxStock = part.stock ?? null;
                const { num: cardQtyNum, overStock } = clampQtyInput(cardQty, maxStock);
                const cartLine = cart.find(i => i.part.id === part.id);
                const atCartMax = maxStock !== null && (cartLine?.qty ?? 0) >= maxStock;
                const qtyMissing = cardQty.trim() === '';
                return (
                  <div key={part.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-papco-navy/20 transition-all group flex flex-col overflow-hidden">
                    <div className="px-4 pt-4 pb-3 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <PartStockBadge stock={part.stock} />
                        {part.brand && (
                          <BrandLogoBadge brand={part.brand} />
                        )}
                      </div>
                      <p className="font-part-num font-bold text-papco-navy text-base leading-tight mb-2">{part.part_number}</p>
                      {part.description && (
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">{part.description}</p>
                      )}
                      {part.category && (
                        <p className="text-[10px] text-gray-400 font-medium">{part.category}</p>
                      )}
                    </div>
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {part.price != null ? (
                            <p className="font-bold text-papco-navy text-base tabular-nums">{convertPrice(part.price, currency)}</p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Price on request</p>
                          )}
                        </div>
                        <button onClick={() => setSelectedPart(part)}
                          className="text-xs text-gray-400 hover:text-papco-navy font-medium transition-colors underline underline-offset-2">
                          Details
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <CatalogQtyInput
                            value={cardQty}
                            overStock={overStock}
                            onChange={value => {
                              const { value: next } = clampQtyInput(value, maxStock);
                              setCardQtys(prev => ({ ...prev, [part.id]: next }));
                            }}
                            onBlur={() => {
                              const { value } = clampQtyInput(cardQtys[part.id] ?? '', maxStock);
                              setCardQtys(prev => ({ ...prev, [part.id]: value }));
                            }}
                          />
                          {(overStock || atCartMax) && maxStock !== null && (
                            <p className="text-[10px] text-red-600 font-semibold mt-1">{MAX_STOCK_MESSAGE(maxStock)}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(part, cardQtyNum)}
                          disabled={qtyMissing || maxStock === 0 || atCartMax}
                          className={`flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap touch-manipulation
                            ${inCart
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : qtyMissing || maxStock === 0 || atCartMax
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-papco-navy text-white hover:bg-papco-navy-dark shadow-sm'}`}>
                          <ShoppingCart size={12} />
                          {atCartMax ? 'Макс.' : inCart ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ── Cart Drawer ── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col sm:flex-row">
          <div className="hidden sm:block flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div
            className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full sm:max-w-md sm:ml-auto bg-white shadow-2xl flex flex-col h-[100dvh] sm:h-full rounded-t-2xl sm:rounded-none mt-auto sm:mt-0">
            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
              style={{ background: 'linear-gradient(90deg,#1a1f6e,#252d8a)' }}>
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-white" />
                <h3 className="font-bold text-white">Cart ({cartCount})</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Currency toggle in cart */}
                <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
                  {(['AED', 'USD'] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all
                        ${currency === c ? 'bg-white text-papco-navy' : 'text-white/70 hover:text-white'}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCart(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                  <p className="text-sm font-medium">Your cart is empty</p>
                </div>
              ) : (
                cart.map(item => {
                  const maxStock = item.part.stock ?? null;
                  const atMax = maxStock !== null && item.qty >= maxStock;
                  return (
                    <div key={item.part.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-part-num font-bold text-papco-navy text-sm truncate tracking-wide">{item.part.part_number}</p>
                        {item.part.brand && (
                          <BrandLogoBadge brand={item.part.brand} size="sm" />
                        )}
                        {item.part.price != null && (
                          <p className="text-xs font-bold text-gray-700 mt-0.5">{convertPrice(item.part.price, currency)}</p>
                        )}
                        {maxStock !== null && (
                          <p className={`text-[10px] mt-0.5 font-semibold tabular-nums ${atMax ? 'text-red-600' : 'text-gray-500'}`}>
                            {atMax ? MAX_STOCK_MESSAGE(maxStock) : `In stock: ${maxStock}`}
                          </p>
                        )}
                      </div>
                      {/* Qty input */}
                      <div className="flex flex-col items-center gap-0.5">
                        {(() => {
                          const draftValue = cartQtyDrafts[item.part.id] ?? String(item.qty);
                          return (
                        <input
                          type="number" min={1} max={maxStock ?? undefined}
                          value={draftValue}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setCartQtyDrafts(prev => ({ ...prev, [item.part.id]: raw }));
                            if (!raw) return;
                            let v = parseInt(raw, 10);
                            if (maxStock !== null && v > maxStock) v = maxStock;
                            setCartItemQty(item.part.id, v);
                            setCartQtyDrafts(prev => ({ ...prev, [item.part.id]: String(v) }));
                          }}
                          onBlur={() => {
                            setCartQtyDrafts(prev => ({ ...prev, [item.part.id]: String(item.qty) }));
                          }}
                          className={`w-14 text-center text-sm font-bold rounded-lg border px-1 py-1 outline-none transition-all
                            ${atMax ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white focus:border-papco-navy'}`}
                        />
                          );
                        })()}
                        {atMax && maxStock !== null && (
                          <p className="text-[9px] text-red-600 text-center leading-tight font-semibold">Макс.</p>
                        )}
                      </div>
                      {item.part.price != null && (
                        <p className="text-xs font-black text-papco-navy w-16 text-right flex-shrink-0">
                          {currency === 'AED'
                            ? `${(item.part.price * item.qty).toFixed(2)} AED`
                            : `$${(item.part.price / USD_TO_AED * item.qty).toFixed(2)}`}
                        </p>
                      )}
                      <button onClick={() => removeFromCart(item.part.id)}
                        className="p-1 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart footer */}
            {cart.length > 0 && (
              <div className="px-4 py-4 border-t border-gray-100 space-y-3 bg-white">
                {cartTotal > 0 && (
                  <div className="px-3 py-2.5 bg-papco-navy/5 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">Total</span>
                      <span className="font-black text-papco-navy text-base">
                        {currency === 'AED' ? `${cartTotal.toFixed(2)} AED` : `$${cartTotal.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">Tax (+5%)</span>
                      <span className="font-black text-papco-navy text-base">
                        {currency === 'AED' ? `${cartTax.toFixed(2)} AED` : `$${cartTax.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-papco-navy/10">
                      <span className="text-sm font-semibold text-gray-700">Amount</span>
                      <span className="font-black text-papco-navy text-base">
                        {currency === 'AED' ? `${cartAmount.toFixed(2)} AED` : `$${cartAmount.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setShowExportModal(true)}
                    className="flex items-center justify-center gap-1.5 min-h-[48px] py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-sm touch-manipulation">
                    <Download size={14} /> Create Excel
                  </button>
                  <button type="button" onClick={() => setShowPayModal(true)}
                    className="flex items-center justify-center gap-1.5 min-h-[48px] py-2.5 rounded-xl bg-papco-red text-white text-sm font-bold transition-colors shadow-sm hover:opacity-90 touch-manipulation">
                    <CreditCard size={14} /> Pay
                  </button>
                </div>
                <button type="button" onClick={clearCart}
                  className="w-full min-h-[44px] py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors font-medium touch-manipulation">
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Not Found Modal ── */}
      {showNotFoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <PackageSearch size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Part Not Found</h3>
                <p className="text-xs text-gray-500">Send a request for this part</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Searched Code</p>
              <p className="font-part-num font-bold text-papco-navy text-lg">{lastSearchedQuery}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity Needed</label>
              <input
                type="number" min={1} value={notFoundQty}
                onChange={e => setNotFoundQty(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
                  focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy focus:bg-white transition-all text-center font-semibold"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowNotFoundModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  openWhatsApp(partNotFoundWhatsAppMessage(lastSearchedQuery, notFoundQty));
                  setShowNotFoundModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors shadow-sm">
                <MessageCircle size={14} /> Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Part Detail Modal ── */}
      {selectedPart && (() => {
        const detailQty = cardQtys[selectedPart.id] ?? '';
        const detailQtyNum = Math.max(1, parseInt(detailQty) || 1);
        const maxDetailStock = selectedPart.stock ?? null;
        const overDetailStock = maxDetailStock !== null && detailQtyNum > maxDetailStock;
        const detailQtyMissing = detailQty.trim() === '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-papco-navy">Part Details</h3>
                <button onClick={() => setSelectedPart(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">
                <div className="bg-papco-navy/5 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Part Number</p>
                  <p className="font-part-num font-bold text-papco-navy text-xl tracking-wide">{selectedPart.part_number}</p>
                </div>
                {[
                  ['Brand', selectedPart.brand],
                  ['Description', selectedPart.description],
                  ['Category', selectedPart.category],
                  ['Price', convertPrice(selectedPart.price, currency)],
                  ['Stock', maxDetailStock !== null ? (maxDetailStock > 0 ? `${maxDetailStock} pcs.` : 'Not in stock') : 'To be confirmed'],
                  ['COO', selectedPart.coo || null],
                ].filter(([, v]) => v && v !== '—').map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                    <span className={`text-sm text-right ml-4 ${label === 'Price' ? 'font-black text-papco-navy' : label === 'Stock' ? 'font-semibold text-green-700' : 'text-gray-800'}`}>{value}</span>
                  </div>
                ))}
                {/* Always show COO row even if empty */}
                {!selectedPart.coo && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">COO</span>
                    <span className="text-sm text-gray-400 italic">—</span>
                  </div>
                )}
                {Object.entries(selectedPart.extra || {}).filter(([, v]) => v !== '' && v != null).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{key}</span>
                    <span className="text-sm text-gray-800 text-right ml-4">{String(value)}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quantity</label>
                    <input
                      type="number" min={1} max={maxDetailStock ?? undefined}
                      value={detailQty}
                      onChange={e => {
                        const { value } = clampQtyInput(e.target.value, maxDetailStock);
                        setCardQtys(prev => ({ ...prev, [selectedPart.id]: value }));
                      }}
                      onBlur={() => {
                        const { value } = clampQtyInput(cardQtys[selectedPart.id] ?? '', maxDetailStock);
                        setCardQtys(prev => ({ ...prev, [selectedPart.id]: value }));
                      }}
                      className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all font-semibold text-center tabular-nums
                        ${overDetailStock ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 focus:border-papco-navy focus:bg-white'}`}
                    />
                    {overDetailStock && maxDetailStock !== null && (
                      <p className="text-[10px] text-red-600 font-semibold">{MAX_STOCK_MESSAGE(maxDetailStock)}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => {
                    if (!overDetailStock && maxDetailStock !== 0) {
                      addToCart(selectedPart, detailQtyNum);
                      setSelectedPart(null);
                    }
                  }}
                  disabled={detailQtyMissing || overDetailStock || maxDetailStock === 0}
                  className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm
                    ${detailQtyMissing || overDetailStock ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-papco-navy text-white hover:bg-papco-navy-dark'}`}>
                  <ShoppingCart size={13} /> Add to Cart
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Excel Export Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Download size={18} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Create Excel File</h3>
                <p className="text-xs text-gray-500">{cart.length} item{cart.length !== 1 ? 's' : ''} in cart</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">File Name</label>
              <input type="text" value={exportFilename}
                onChange={e => setExportFilename(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleExport()}
                placeholder="e.g. My_Parts_Order"
                autoFocus
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
                  focus:ring-2 focus:ring-green-200 focus:border-green-400 focus:bg-white transition-all" />
              <p className="text-[11px] text-gray-400 mt-1">Will be saved as .csv (opens in Excel)</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-sm">
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Modal ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <CreditCard size={26} className="text-papco-navy" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Payment</h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                For accurate payment confirmation, please verify the pay method with your manager before proceeding.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPayModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  openWhatsApp();
                  setShowPayModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors shadow-sm">
                <MessageCircle size={15} /> Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Price List by Brand Tab ───────────────────────────────────────────────────

const MAX_BRANDS_SELECT = 3;

function SelectableBrandCard({
  brand,
  selected,
  disabled,
  onToggle,
}: {
  brand: Brand;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cardBg = brand.noBg ? 'transparent' : (brand.bg ?? '#fff');
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex flex-col items-center gap-1.5 select-none rounded-xl p-1 transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${selected ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
      style={{
        transform: !disabled && hovered ? 'scale(1.04) translateY(-2px)' : 'scale(1) translateY(0)',
        transition: 'transform 0.25s ease, opacity 0.25s ease',
      }}
    >
      {selected && (
        <span className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-green-600 flex items-center justify-center shadow-md">
          <CheckCircle2 size={12} className="text-white" />
        </span>
      )}
      <div
        className="relative flex items-center justify-center rounded-xl w-[132px] h-[80px] px-2.5 overflow-hidden shrink-0"
        style={brand.noBg ? {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        } : {
          background: cardBg,
          border: selected
            ? '1.5px solid #16a34a'
            : hovered
              ? `1.5px solid ${brand.color}60`
              : '1.5px solid #e2e6ea',
          boxShadow: selected
            ? '0 6px 24px rgba(22,163,74,0.2), 0 2px 8px rgba(0,0,0,0.08)'
            : hovered
              ? `0 6px 24px ${brand.color}25, 0 2px 8px rgba(0,0,0,0.08)`
              : '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'border 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {brand.img ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ background: cardBg }}>
            <img
              src={brand.img}
              alt={brand.name}
              draggable={false}
              className="block max-w-full max-h-full object-contain"
              style={{
                transform: brand.imgScale ? `scale(${brand.imgScale})` : undefined,
                mixBlendMode: brand.blendMultiply ? 'multiply' : undefined,
              }}
            />
          </div>
        ) : (
          <span
            className="font-black text-center leading-tight"
            style={{
              color: brand.color,
              fontSize: brand.name.length > 10 ? '11px' : brand.name.length > 7 ? '13px' : '15px',
              fontFamily: "'Arial Black', 'Arial', sans-serif",
            }}
          >
            {brand.name}
          </span>
        )}
      </div>
      <span
        className="text-center font-medium leading-tight w-[132px]"
        style={{ color: selected ? '#1a1f6e' : '#6b7280', fontSize: '9px', letterSpacing: '0.02em' }}
      >
        {brand.category}
      </span>
    </button>
  );
}

function PriceListBrandPicker({
  selectedBrands,
  onToggle,
  onClose,
}: {
  selectedBrands: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  const atMax = selectedBrands.length >= MAX_BRANDS_SELECT;

  const renderSection = (title: string, brands: Brand[]) => (
    <div className="mb-8 last:mb-0">
      <SectionHeaderBar title={title} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 px-2 justify-items-center">
        {brands.map((brand, i) => (
          <SelectableBrandCard
            key={`${brand.name}-${brand.category}-${i}`}
            brand={brand}
            selected={selectedBrands.includes(brand.name)}
            disabled={atMax && !selectedBrands.includes(brand.name)}
            onToggle={() => onToggle(brand.name)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[min(92vh,900px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-gray-200/80"
        style={{
          background: 'linear-gradient(180deg, #f0f2f8 0%, #e8ebf5 100%)',
          borderTop: '3px solid #cc1f1f',
          borderBottom: '3px solid #cc1f1f',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231a1f6e' fill-opacity='1'%3E%3Ccircle cx='40' cy='40' r='30' stroke='%231a1f6e' stroke-width='4' fill='none'/%3E%3Ccircle cx='40' cy='40' r='18' stroke='%231a1f6e' stroke-width='4' fill='none'/%3E%3Ccircle cx='40' cy='40' r='7'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px',
          }}
        />

        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200/80 bg-white/70 backdrop-blur-sm">
          <div>
            <h3 className="text-base sm:text-lg font-black text-papco-navy uppercase tracking-wide">Brand Catalog</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select up to {MAX_BRANDS_SELECT} brands — {selectedBrands.length}/{MAX_BRANDS_SELECT} chosen
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-papco-navy text-white text-xs sm:text-sm font-semibold hover:bg-papco-navy-dark transition-colors shrink-0"
          >
            Done <X size={14} />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto p-4 sm:p-6">
          {renderSection('Own Brands', ownBrands)}
          {renderSection('Main Brands', mainBrands)}
          {renderSection('Partner Brands', partnerBrands)}
        </div>

        {atMax && (
          <div className="relative px-4 sm:px-6 py-3 border-t border-amber-200 bg-amber-50 text-xs text-amber-800 font-medium text-center">
            Maximum {MAX_BRANDS_SELECT} brands selected. Tap a selected brand to remove it.
          </div>
        )}
      </div>
    </div>
  );
}

function PriceListTab({ user, profile }: { user: SupabaseUser; profile: UserProfile | null }) {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!showBrandPicker) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showBrandPicker]);

  const toggleBrand = (b: string) => {
    setSelectedBrands(prev => {
      if (prev.includes(b)) return prev.filter(x => x !== b);
      if (prev.length >= MAX_BRANDS_SELECT) return prev;
      return [...prev, b];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBrands.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const brandStr = selectedBrands.join(', ');
      const { error: dbErr } = await supabase.from('user_requests').insert({
        user_id: user.id,
        type: 'pricelist_request',
        query: `Brand(s): ${brandStr}${note.trim() ? ` | Note: ${note.trim()}` : ''}`,
        status: 'pending',
      });
      if (dbErr) throw dbErr;

      void notifyPriceListRequest({
        userFullName: profile?.full_name || user.email || '',
        userCompany: profile?.company_name || '',
        userEmail: user.email || '',
        userPhone: profile?.phone || '',
        brand: brandStr,
        note: note.trim(),
      });

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-7 flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Request Sent!</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs leading-relaxed">
            Your price list request for <strong>{selectedBrands.join(', ')}</strong> has been sent to our team via WhatsApp. We will respond shortly.
          </p>
        </div>
        <button onClick={() => { setSuccess(false); setSelectedBrands([]); setNote(''); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-semibold hover:bg-papco-navy-dark transition-colors">
          <ChevronLeft size={15} /> New Request
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-7 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
          <Tag size={20} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-papco-navy">Price List Request by Brand</h2>
          <p className="text-xs text-gray-500">Select up to 3 brands — request sent directly to our team via WhatsApp</p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-sm">
        <MessageCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
        <p className="text-green-800 leading-relaxed">
          Your request will be instantly sent to our sales team on <strong>WhatsApp</strong> and we'll get back to you as soon as possible.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Select Brands * <span className="font-normal text-gray-400 normal-case">(max {MAX_BRANDS_SELECT})</span>
          </label>

          {/* Selected tags */}
          {selectedBrands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {selectedBrands.map(b => {
                const logo = lookupBrandLogo(b);
                return (
                <span key={b} className="flex items-center gap-1.5 px-2 py-1 bg-papco-navy text-white text-xs font-semibold rounded-full">
                  {logo && (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-white overflow-hidden shrink-0">
                      <img src={logo} alt={b} className="w-full h-full object-contain p-0.5" loading="lazy" decoding="async" />
                    </span>
                  )}
                  {b}
                  <button type="button" onClick={() => toggleBrand(b)} className="hover:opacity-70 transition-opacity">
                    <X size={11} />
                  </button>
                </span>
              );})}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowBrandPicker(true)}
            className="w-full flex items-center gap-2 px-3 py-3 rounded-xl border text-left cursor-pointer transition-all
              border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-white"
          >
            <Tag size={15} className="text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-sm text-gray-500">
              {selectedBrands.length > 0
                ? `${selectedBrands.length} brand${selectedBrands.length > 1 ? 's' : ''} selected — open catalog`
                : 'Choose a brand…'}
            </span>
            <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
          </button>

          {showBrandPicker && (
            <PriceListBrandPicker
              selectedBrands={selectedBrands}
              onToggle={toggleBrand}
              onClose={() => setShowBrandPicker(false)}
            />
          )}

          {selectedBrands.length >= MAX_BRANDS_SELECT && (
            <p className="text-xs text-amber-600 font-medium">Maximum {MAX_BRANDS_SELECT} brands selected. Remove one to add another.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Additional Notes <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="e.g. Specific part categories, vehicle models, or any other details…"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
              focus:ring-2 focus:ring-green-200 focus:border-green-500 focus:bg-white transition-all resize-none" />
        </div>
        <button type="submit" disabled={loading || selectedBrands.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white text-sm
            bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-all
            shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><MessageCircle size={15} /> Send via WhatsApp</>}
        </button>
      </form>
    </div>
  );
}

// ─── Excel Request Tab ─────────────────────────────────────────────────────────

function ExcelRequestTab({ user, profile }: { user: SupabaseUser; profile: UserProfile | null }) {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;
    setLoading(true);
    setError('');
    try {
      await submitExcelRequest({
        userId: user.id,
        file: excelFile,
        note: note.trim(),
        userFullName: profile?.full_name || user.email || '',
        userCompany: profile?.company_name || '',
        userEmail: user.email || '',
        userPhone: profile?.phone || '',
      });

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-7 flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Request Sent!</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs leading-relaxed">
            Your Excel parts list <strong>{excelFile?.name}</strong> has been received. Our team will process it and respond to you shortly.
          </p>
        </div>
        <button onClick={() => { setSuccess(false); setExcelFile(null); setNote(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-semibold hover:bg-papco-navy-dark transition-colors">
          <ChevronLeft size={15} /> New Request
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-7 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet size={20} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-papco-navy">Excel Parts Request</h2>
          <p className="text-xs text-gray-500">Upload your parts list and we'll process it for you</p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm">
        <MessageCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-blue-800 leading-relaxed">
          Upload your Excel file with part numbers. Our team will be notified instantly via <strong>WhatsApp</strong> and will process your list promptly.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upload Excel File *</label>
          <label className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${excelFile ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-papco-navy/40 hover:bg-blue-50/30'}`}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e => { setExcelFile(e.target.files?.[0] || null); setError(''); }} />
            {excelFile ? (
              <>
                <CheckCircle2 size={32} className="text-green-500" />
                <div className="text-center">
                  <p className="font-semibold text-green-700 text-sm">{excelFile.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{(excelFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <span className="text-xs text-green-600 font-medium">Click to change file</span>
              </>
            ) : (
              <>
                <Upload size={32} className="text-gray-300" />
                <div className="text-center">
                  <p className="font-semibold text-gray-600 text-sm">Drop your file here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
                </div>
              </>
            )}
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="e.g. Urgency, specific brands preferred, delivery terms…"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
              focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-all resize-none" />
        </div>
        <button type="submit" disabled={loading || !excelFile}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white text-sm
            bg-papco-navy hover:bg-papco-navy-dark active:scale-[0.98] transition-all
            shadow-lg shadow-papco-navy/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Send size={15} /> Send Request</>}
        </button>
      </form>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

interface AdminFile {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

function Dashboard({ user, profile, onGoHome }: { user: SupabaseUser; profile: UserProfile | null; onGoHome: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('search');
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [adminFiles, setAdminFiles] = useState<AdminFile[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadRequests = useCallback(async () => {
    const [{ data: reqData, error: reqErr }, { data: fileData, error: fileErr }] = await Promise.all([
      supabase
        .from('user_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('file_attachments')
        .select('id, filename, file_path, file_size, mime_type, uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(50),
    ]);
    if (!reqErr && reqData) {
      setRequests(reqData.filter(r => r.type !== 'admin_file'));
    }
    if (!fileErr && fileData) {
      setAdminFiles(fileData.filter(f => !shouldHideFromClientRequests(f)));
    }
  }, [user.id]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleDeleteRequest = async (id: string) => {
    const { error } = await supabase.from('user_requests').delete().eq('id', id).eq('user_id', user.id);
    if (!error) setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleClearAllRequests = async () => {
    if (!confirm('Clear all your requests?')) return;
    const { error } = await supabase.from('user_requests').delete().eq('user_id', user.id);
    if (!error) setRequests([]);
  };

  const handleDeleteAdminFile = async (id: string) => {
    const file = adminFiles.find(f => f.id === id);
    if (!file) return;
    if (!confirm(`Delete «${file.filename}» from history?`)) return;
    if (file.file_path) {
      await supabase.storage.from('admin-files').remove([file.file_path]);
    }
    const { error } = await supabase.from('file_attachments').delete().eq('id', id).eq('user_id', user.id);
    if (!error) setAdminFiles(prev => prev.filter(f => f.id !== id));
  };

  const tabs: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
    { id: 'search', label: 'Catalog Search', icon: PackageSearch },
    { id: 'pricelist', label: 'Price List by Brand', icon: Tag },
    { id: 'excel', label: 'Excel Request', icon: FileSpreadsheet },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Welcome bar */}
      <div className="px-4 sm:px-8 py-4"
        style={{ background: 'linear-gradient(90deg, #1a1f6e 0%, #252d8a 60%, #1a1f6e 100%)' }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onGoHome}
              title="Back to Home"
              className="flex items-center gap-1.5 min-h-[44px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex-shrink-0 touch-manipulation">
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Home</span>
            </button>
            <div>
              <h2 className="text-white font-bold text-base sm:text-lg">
                Welcome, {profile?.full_name || user.email}
              </h2>
              {profile?.company_name && (
                <p className="text-blue-200 text-xs sm:text-sm">{profile.company_name}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setShowHistory(v => !v)}
            className="flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium transition-colors touch-manipulation">
            <Clock size={14} />
            <span className="hidden sm:inline">My Requests</span>
            <ChevronDown size={14} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            {(requests.length + adminFiles.length) > 0 && (
              <span className="bg-papco-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {requests.length + adminFiles.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="px-4 sm:px-8 py-4 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-4xl mx-auto space-y-5">
            <div>
              <h3 className="text-sm font-bold text-papco-navy mb-1">My Requests</h3>
              <p className="text-xs text-gray-400 mb-3">Your requests and files from PAPCO</p>
              {adminFiles.length > 0 && (
                <div className="space-y-2 mb-4">
                  {adminFiles.map(f => (
                    <AdminFileRow key={f.id} file={f} onDelete={handleDeleteAdminFile} />
                  ))}
                </div>
              )}
              <RequestHistory
                requests={requests}
                onDelete={handleDeleteRequest}
                onClearAll={handleClearAllRequests}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-papco-navy">Search & Requests</h1>
          <p className="text-gray-500 text-sm mt-1">Search our parts catalog or submit a request to our team</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-1 justify-center
                  ${active ? 'bg-papco-navy text-white shadow-md' : 'text-gray-500 hover:text-papco-navy hover:bg-gray-50'}`}>
                <Icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === 'search' ? 'Search' : tab.id === 'pricelist' ? 'Price List' : 'Excel'}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {activeTab === 'search' && <CatalogSearchTab user={user} profile={profile} />}
          {activeTab === 'pricelist' && <PriceListTab user={user} profile={profile} />}
          {activeTab === 'excel' && <ExcelRequestTab user={user} profile={profile} />}
        </div>
      </div>
    </div>
  );
}

// ─── Pending / Rejected Screen ────────────────────────────────────────────────

function AccessStatusScreen({
  mode,
  profile,
  onOk,
  onManager,
  onRegister,
}: {
  mode: 'pending' | 'rejected' | 'deleted';
  profile: UserProfile | null;
  onOk: () => void;
  onManager: () => void;
  onRegister: () => void;
}) {
  const isPending = mode === 'pending';
  const isRejected = mode === 'rejected';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f0f2f8 0%, #e8ebf5 100%)' }}>
      {/* Header */}
      <div className="h-1 bg-gradient-to-r from-papco-navy via-papco-red to-papco-navy" />
      <div className="flex items-center px-6 py-4 bg-white border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-papco-navy flex items-center justify-center">
          <span className="text-white font-black text-xs">P</span>
        </div>
        <span className="ml-3 font-black text-papco-navy text-sm tracking-wide uppercase hidden sm:inline">PAPCO Online Platform</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-300/50 overflow-hidden border border-slate-100">
            {/* Status banner */}
            <div
              className="px-8 py-6 text-center"
              style={{
                background: isPending
                  ? 'linear-gradient(90deg, #92400e, #b45309)'
                  : 'linear-gradient(90deg, #991b1b, #b91c1c)',
              }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                {isPending
                  ? <Clock size={32} className="text-white" />
                  : <AlertCircle size={32} className="text-white" />}
              </div>
              <h2 className="text-white font-black text-xl">
                {isPending ? 'Awaiting Confirmation' : isRejected ? 'Registration Declined' : 'Account Not Found'}
              </h2>
              <p className="text-white/70 text-sm mt-1">
                {isPending ? 'Your application is under review' : isRejected ? 'Contact manager for more information' : 'Please register again to continue'}
              </p>
            </div>

            {/* Body */}
            <div className="px-8 py-7">
              <div className="flex items-start gap-4 mb-6 p-4 rounded-xl"
                style={{
                  background: isPending ? '#fffbeb' : '#fef2f2',
                  border: isPending ? '1px solid #fde68a' : '1px solid #fecaca',
                }}>
                {isPending
                  ? <Bell size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  : <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
                <p className="text-sm leading-relaxed"
                  style={{ color: isPending ? '#92400e' : '#991b1b' }}>
                  {isPending
                    ? 'Your request is pending. Please wait for administrator approval.'
                    : isRejected
                      ? profile?.rejection_reason
                        ? <>Your registration was declined by the administrator. Reason: <em>{profile.rejection_reason}</em></>
                        : 'Your registration request was declined by the administrator.'
                      : 'This account was removed. Please register again to continue using the platform.'}
                </p>
              </div>

              {/* User info */}
              <div className="space-y-2 mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Details</p>
                {[
                  ['Name', profile?.full_name || '—'],
                  ['Company', profile?.company_name || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-700">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2">
                  <span className="text-xs text-gray-400">Status</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isPending ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
                  }`}>
                    {isPending ? 'Pending Approval' : isRejected ? 'Rejected' : 'Deleted'}
                  </span>
                </div>
              </div>

              {isPending && (
                <button
                  onClick={onOk}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  OK
                </button>
              )}

              {isRejected && (
                <div className="flex gap-2">
                  <button
                    onClick={onOk}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    OK
                  </button>
                  <button
                    onClick={onManager}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
                  >
                    <MessageCircle size={15} /> Manager
                  </button>
                </div>
              )}

              {!isPending && !isRejected && (
                <div className="flex gap-2">
                  <button
                    onClick={onOk}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    OK
                  </button>
                  <button
                    onClick={onRegister}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm bg-papco-navy hover:bg-papco-navy-dark text-white transition-colors"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} PAPCO — Public Auto Parts Co. LLC. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showHomepage, setShowHomepage] = useState(false);
  const [showAdminHomepage, setShowAdminHomepage] = useState(false);
  const [accessNotice, setAccessNotice] = useState<{
    mode: 'pending' | 'rejected' | 'deleted';
    profile: UserProfile | null;
  } | null>(null);
  const [registerPrefillEmail, setRegisterPrefillEmail] = useState('');
  const [, setWasApproved] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => { await loadProfile(session.user.id); })();
      } else {
        setProfile(null);
        setWasApproved(false);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, company_name, phone, country, city, address, email, is_admin, registration_status, rejection_reason')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      if (isDeletedUserProfile(data)) {
        setProfile(null);
        setAccessNotice({ mode: 'deleted', profile: null });
        setAuthLoading(false);
        return;
      }
      setProfile(data);
      if (data.registration_status === 'approved') setWasApproved(true);
      if (!data.is_admin && data.registration_status !== 'approved') {
        setAccessNotice({
          mode: data.registration_status === 'pending' ? 'pending' : 'rejected',
          profile: data,
        });
      } else {
        setAccessNotice(null);
      }
    } else {
      setProfile(null);
      setAccessNotice({ mode: 'deleted', profile: null });
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowHomepage(false);
    setShowAdminHomepage(false);
    setAccessNotice(null);
    setWasApproved(false);
  };

  const handleManagerWhatsApp = () => {
    window.open('https://wa.me/971547713447', '_blank', 'noopener,noreferrer');
  };

  const handleRegisterAgain = async () => {
    const email = user?.email?.toLowerCase().trim() ?? '';
    if (email) {
      await reclaimDeletedEmail(email);
      setRegisterPrefillEmail(email);
    }
    await handleSignOut();
    setActiveTab('register');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <span className="w-8 h-8 border-3 border-papco-navy/30 border-t-papco-navy rounded-full animate-spin" style={{ borderWidth: 3 }} />
      </div>
    );
  }

  // Route admin to admin panel (unless they clicked Home)
  if (user && profile?.is_admin && !showAdminHomepage) {
    return <AdminPanel user={user} onSignOut={handleSignOut} onGoHome={() => setShowAdminHomepage(true)} />;
  }

  if (accessNotice) {
    return (
      <AccessStatusScreen
        mode={accessNotice.mode}
        profile={accessNotice.profile}
        onOk={handleSignOut}
        onManager={handleManagerWhatsApp}
        onRegister={handleRegisterAgain}
      />
    );
  }

  // If logged in and approved but wants to see homepage
  const showDashboard = user && profile?.registration_status === 'approved' && !showHomepage;

  return (
    <div className="min-h-screen flex flex-col">
      <LogoShowcase user={user} profile={profile} onSignOut={handleSignOut} />

      {showDashboard ? (
        <Dashboard user={user!} profile={profile} onGoHome={() => setShowHomepage(true)} />
      ) : (
        <>
          {user && (profile?.is_admin || profile?.registration_status === 'approved') && (
            <div className="px-4 sm:px-8 py-3 bg-papco-navy/5 border-b border-papco-navy/10">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <p className="text-sm text-papco-navy font-medium">
                  Welcome back, <strong>{profile?.full_name}</strong>
                </p>
                {profile?.is_admin ? (
                  <button
                    onClick={() => setShowAdminHomepage(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-papco-navy text-white text-sm font-bold hover:bg-papco-navy-dark transition-colors shadow-sm">
                    <Shield size={14} /> Admin Panel
                  </button>
                ) : (
                  <button
                    onClick={() => setShowHomepage(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-papco-navy text-white text-sm font-bold hover:bg-papco-navy-dark transition-colors shadow-sm">
                    <PackageSearch size={14} /> Open Catalog
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="text-center pt-10 pb-6 px-4">
            <h1 className="text-3xl sm:text-4xl font-black text-papco-navy tracking-tight">
              Online <span className="text-papco-red">Platform</span>
            </h1>
            <p className="mt-2 text-gray-500 text-sm sm:text-base max-w-md mx-auto">
              Sign in or create an account to access the PAPCO Online Platform
            </p>
          </div>

          {!user && (
            <main className="flex items-start justify-center px-4 pb-12">
              <div className="w-full max-w-2xl">
                <div className="bg-white rounded-2xl shadow-2xl shadow-slate-300/50 overflow-hidden border border-slate-100">
                  <div className="flex border-b border-gray-100 bg-gray-50">
                    {(['login', 'register'] as Tab[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 relative
                          ${activeTab === tab ? 'text-papco-navy bg-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                      >
                        {tab === 'login' ? 'Sign In' : 'Register'}
                        {activeTab === tab && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-papco-red rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="p-6 sm:p-8">
                    {activeTab === 'login'
                      ? <LoginSection />
                      : (
                        <RegisterSection
                          initialEmail={registerPrefillEmail}
                          onSwitchToLogin={() => {
                            setRegisterPrefillEmail('');
                            setActiveTab('login');
                          }}
                        />
                      )}
                  </div>
                </div>
                <p className="text-center text-xs text-gray-400 mt-6">
                  © {new Date().getFullYear()} PAPCO — Public Auto Parts Co. LLC. All rights reserved.
                </p>
              </div>
            </main>
          )}

          <BrandsShowcase />
        </>
      )}

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
