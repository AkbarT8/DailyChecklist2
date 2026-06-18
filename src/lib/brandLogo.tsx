import kybLogo from '../../public/KYB-logo.png';
import totoPistonsLogo from '../../public/Toto_Pistons.webp';
import seikenLogo from '../../public/seikin.png';
import taihoLogo from '../../public/TAIHO.jpg';
import alphasLogo from "../../public/ALPHA'S.png";
import tpLogo from '../../public/tp-logo-al-shamali.png';
import axcelLogo from '../../public/AXCEL.jpeg';
import daidoLogo from '../../public/daido_metal.webp';
import rikLogo from '../../public/rik.png';
import stoneLogo from '../../public/Stone.png';
import torchLogo from '../../public/images.png';
import ndcLogo from '../../public/JbswVnXlmT32NPrk-original.jpeg';
import musashiLogo from '../../public_safe/MUSASHI.png';
import npwLogo from '../../public_safe/7sDOZLAoLTcRZ2bh-original.jpeg';
import tamaLogo from '../../public_safe/tama.png';
import flammaLogo from '../../public_safe/flamma.jpg';
import kyosanLogo from '../../public_safe/kyosan.png';
import izumiLogo from '../../public/izumi2-280x280.jpg';
import napLogo from '../../public/NAP-03.png';
import superTurboLogo from '../../public/SUPER_TURBO-04.png';
import axicsLogo from '../../public/Copy_of_Posters_(2).png';
import mitsubishiElectricLogo from '../../public/Mitsubishi_Electric_logo.png';
import dreikLogo from '../../public/New-Project-35-16-1024x1024.webp';
import napcoLogo from '../../public/napco-logo-al-shamali.png';
import osakaLogo from '../../public/OSAKA.png';
import hktLogo from '../../public/hkt-logo-al-shamali.png';
import aisanLogo from '../../public/aisan-industry-logo-png_seeklogo-499248.png';
import parautLogo from '../../public/paraut-logo-al-shamali.png';
import ficLogo from '../../public/fic-logo-al-shamali.png';
import fujiLogo from '../../public/unnamed.jpg';
import oskLogo from '../../public/TKT008K.webp';
import mitoyoLogo from '../../public/MITOYO_ロゴ2019作成.jpg';
import didLogo from '../../public/DID_PNG.webp';
import toyoLogo from '../../public/TOYOマークカラー大-02.png';
import camelliaLogo from '../../public/CAMELLIA.jpg';
import tskLogo from '../../public/fWVZxQOdUQ8GD3Ju-original.jpeg';
import shimahideLogo from '../../public/SHIMAHIDE-LOGO-1-1024x189.png';
import samLogo from '../../public/images_(1).png';
import nittanLogo from '../../public/logo2.png';
import rockyLogo from '../../public/rocky_engine_valves-logo-al-shamali.png';
import sunLogo from '../../public/SUN_UNISOL.png';
import koitoLogo from '../../public/7276.T_BIG-e00be6d1.png';
import vicLogo from '../../public/VIC-removebg-preview_1_cb763f1f-b61b-4037-adba-980c1456f29b.webp';
import sankeiLogo from '../../public/New-Project-32.webp';
import newEraLogo from '../../public/New-Project-28-1024x1024.webp';
import mrkLogo from '../../public/0d5c9c-main-301455d922e7fb24a715efb146cc9bd9.png';
import seiwaLogo from '../../public/images copy copy copy.png';
import elecmanLogo from '../../public/ELECMAN.png';
import nkkLogo from '../../public/NKK.png';
import teLogo from '../../public/TE.png';

const brandLogoByKey = new Map<string, string>(
  [
    ['AXIOS', axicsLogo],
    ['AXCEL', axcelLogo],
    ['NAP', napLogo],
    ['SUPERTURBO', superTurboLogo],
    ['KYB', kybLogo],
    ['TOTOPISTONS', totoPistonsLogo],
    ['SEIKEN', seikenLogo],
    ['TAIHO', taihoLogo],
    ['ALPHAS', alphasLogo],
    ['TP', tpLogo],
    ['NDC', ndcLogo],
    ['STONE', stoneLogo],
    ['DAIDOMETAL', daidoLogo],
    ['RIK', rikLogo],
    ['TORCH', torchLogo],
    ['MUSASHI', musashiLogo],
    ['IZUMI', izumiLogo],
    ['NPW', npwLogo],
    ['TAMA', tamaLogo],
    ['FLAMMA', flammaLogo],
    ['KYOSAN', kyosanLogo],
    ['MITSUBISHIELECTRIC', mitsubishiElectricLogo],
    ['DREIK', dreikLogo],
    ['MRK', mrkLogo],
    ['SEIWA', seiwaLogo],
    ['OSAKANUT', osakaLogo],
    ['NAPCO', napcoLogo],
    ['HKT', hktLogo],
    ['AISAN', aisanLogo],
    ['FUJI', fujiLogo],
    ['PARAUT', parautLogo],
    ['FIC', ficLogo],
    ['MITOYO', mitoyoLogo],
    ['OSK', oskLogo],
    ['DID', didLogo],
    ['CAMELLIA', camelliaLogo],
    ['TOYO', toyoLogo],
    ['TSK', tskLogo],
    ['SAM', samLogo],
    ['SHIMAHIDE', shimahideLogo],
    ['NITTAN', nittanLogo],
    ['SUNUNISOL', sunLogo],
    ['KOITO', koitoLogo],
    ['ROCKY', rockyLogo],
    ['NKK', nkkLogo],
    ['TE', teLogo],
    ['NEWERA', newEraLogo],
    ['SANKEI', sankeiLogo],
    ['VIC', vicLogo],
    ['ELECMAN', elecmanLogo],
  ],
);

function normalizeBrandKey(name: string): string {
  return name.toUpperCase().replace(/[.\s'/-]/g, '');
}

export function lookupBrandLogo(brand: string): string | undefined {
  return brandLogoByKey.get(normalizeBrandKey(brand));
}

/** Logo-only badge for catalog cards (no brand name text). */
export function BrandLogoBadge({
  brand,
  size = 'md',
}: {
  brand: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const logo = lookupBrandLogo(brand);
  const sizeClass =
    size === 'sm' ? 'w-12 h-8' :
    size === 'lg' ? 'w-16 h-10' :
    'w-14 h-9';

  if (!logo) {
    return (
      <span
        className="text-[10px] font-bold text-papco-navy/70 truncate max-w-[88px]"
        title={brand}
      >
        {brand}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${sizeClass} rounded-lg bg-white border border-gray-100 overflow-hidden shrink-0 shadow-sm`}
      title={brand}
    >
      <img
        src={logo}
        alt={brand}
        className="w-full h-full object-contain p-1"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
