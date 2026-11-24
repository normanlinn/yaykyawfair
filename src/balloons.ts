// The fire balloon field (မီးပုံးပျံကွင်း): ward teams fill big paper balloons over a smoky fire, the way Taunggyi does every
// Tazaungdaing. Animal balloons go up by day, and at night the sein na pan (စိန်နားပန်) rises hung with little lanterns.
import type { Line, Topic } from './shops';

export type BalKind = 'elephant' | 'hintha' | 'owl' | 'ox' | 'lantern';
/** Day balloons, and what each is called. */
export const DAY_KINDS: Array<{ k: BalKind; name: string; my: string }> = [
  { k: 'elephant', name: 'elephant', my: 'ဆင်' }, { k: 'hintha', name: 'hintha', my: 'ဟင်္သာ' },
  { k: 'owl', name: 'owl', my: 'ဇီးကွက်' }, { k: 'ox', name: 'ox', my: 'နွား' },
];
export const NIGHT_KIND = { k: 'lantern' as BalKind, name: 'sein na pan', my: 'စိန်နားပန်' };
/** How many of each balloon the 3D world keeps, so the game never asks for more at once. */
export const BAL_POOL: Record<BalKind, number> = { elephant: 1, hintha: 1, owl: 1, ox: 1, lantern: 3 };
/** Little lanterns hung under each night balloon. */
export const BAL_LANTERNS = 48;

/** The teams taking turns at the launch frame. Team 0 is Sai Htun's crew, the one you can join. */
export const TEAMS: Array<{ my: string; en: string }> = [
  { my: 'တောင်ကြီး ညီနောင်များ', en: 'Taunggyi Brothers' },
  { my: 'ကမာရွတ် လူငယ်များ', en: 'Kamayut Youth' },
  { my: 'သာကေတ ရပ်ကွက်', en: 'Thaketa Ward' },
  { my: 'အလုံ မီးပုံးအဖွဲ့', en: 'Ahlone Balloon Club' },
];

export const LEAD_WHO: Line = ['စိုင်းထွန်း', 'Sai Htun, the crew leader'];
export const LEAD_HELLO: Line[] = [
  ['မင်္ဂလာပါ၊ တောင်ကြီးကနေ မီးပုံးလာလွှတ်တာ', 'Mingalaba! We came down from Taunggyi to fly balloons.'],
  ['အဖွဲ့ထဲ ဝင်ကူမလား၊ လက်တစ်စုံ လိုနေတယ်', 'Want to join the crew? We need another pair of hands.'],
];
export const JOIN: Line = ['ကူပါရစေ', 'Let me help!'];
export const JOIN_BUSY: Line = ['ခဏစောင့်၊ အခု သူတို့အဖွဲ့ အလှည့်။ ပြီးရင် ငါတို့ လွှတ်မယ်', 'Hold on, it’s their team’s turn now. We go next.'];
export const LEAD_TOPICS: Topic[] = [
  { q: ['ဒီဓလေ့က ဘယ်ကလာတာလဲ', 'Where does this come from?'],
    a: ['ရှမ်းပြည် တောင်ကြီးက တန်ဆောင်တိုင် မီးပုံးပျံပွဲတော်ကပါ။ နှစ်ပေါင်း တစ်ရာကျော် လွှတ်လာကြတာ', 'From the Tazaungdaing fire balloon festival in Taunggyi, in Shan State. People have flown them there for more than a hundred years.'] },
  { q: ['ဘာလို့ မီးပုံး လွှတ်ကြတာလဲ', 'Why do people fly the balloons?'],
    a: ['တာဝတိံသာ နတ်ပြည်က စူဠာမဏိစေတီတော်ကို ပူဇော်တာပါ။ မီးပုံး တက်သွားရင် ဆုတောင်းလည်း လိုက်ပါသွားတယ်လို့ ယုံကြတယ်', 'It’s an offering to the Sulamani stupa in Tavatimsa heaven. We believe our prayers go up with the balloon.'] },
  { q: ['စိန်နားပန်ဆိုတာ ဘာလဲ', 'What is a sein na pan?'],
    a: ['ညမီးပုံးပါ။ မီးပုံးအောက်မှာ မီးအိမ်လေးတွေ ချိတ်ထားတော့ ကောင်းကင်မှာ စိန်နားပန်လို တလက်လက် တောက်နေတာ', 'A night balloon. Little lanterns hang under it, so up in the sky it sparkles like diamond earrings.'] },
  { q: ['နေ့ဘက်မှာရော', 'And in the daytime?'],
    a: ['နေ့မီးပုံးတွေက ဆင်၊ ဟင်္သာ၊ ဇီးကွက်၊ နွား ပုံ လုပ်ထားတာ။ ဘယ်အဖွဲ့ အလှဆုံးလဲ ဒိုင်လူကြီးတွေ အမှတ်ပေးတယ်', 'Day balloons are shaped like elephants, hinthas, owls and oxen. The judges score which team’s is the finest.'] },
  { q: ['ဘယ်လို လုပ်ရတာလဲ', 'How do you make one?'],
    a: ['ရှမ်းစက္ကူ အချပ်ပေါင်း ရာနဲ့ချီ ကော်နဲ့ ကပ်ရတယ်။ တစ်လုံးကို ရက်သတ္တပတ်နဲ့ချီ ကြာတယ်', 'We glue together hundreds of sheets of Shan mulberry paper. One balloon takes weeks.'] },
  { q: ['မီးကျည်တွေရော ပါလား', 'Do they carry fireworks?'],
    a: ['တောင်ကြီးမှာတော့ ပါတာ ရှိတယ်။ ဒီမှာက မြို့ထဲဆိုတော့ ဘေးကင်းအောင် မီးကျည် မထည့်ဘူး၊ မီးအိမ်လေးတွေပဲ', 'In Taunggyi some do. Here in the city we leave them out to be safe, only the little lanterns.'] },
];
export const LEAD_BYE: Line = ['ကောင်းကင်ထိ တက်ပါစေ', 'May it reach the sky!'];

/** What the leader calls while you feed the fire. */
export const FIRE_LINES: { hot: Line; cold: Line; good: Line[] } = {
  hot: ['မီးနည်းနည်း လျှော့၊ စက္ကူ လောင်မယ်', 'Ease off the fire, the paper will burn!'],
  cold: ['မီးထပ်ထိုး၊ အငွေ့ မလောက်ဘူး', 'More fire, there’s not enough hot air!'],
  good: [['ကောင်းတယ် ကောင်းတယ်၊ ဖောင်းလာပြီ', 'Good, good, it’s filling up!'], ['ပါးစပ်ကို မီးပေါ် တည့်တည့်ထား', 'Keep the mouth right over the fire!'], ['ဒီအတိုင်း ဒီအတိုင်း', 'Just like that, just like that.']],
};
export const LIGHT_LINE: Line = ['မီးအိမ်လေးတွေ ထွန်းကြ၊ မြန်မြန်', 'Light the little lanterns, quick!'];
export const LET_GO: Line = ['လွှတ်!', 'Let go!'];
export const CHEERS: Line[] = [['တက်ပြီ တက်ပြီ', 'It’s going up!'], ['ဟေး ဟေး ဟေး', 'Hey, hey, hey!'], ['လှလိုက်တာ', 'So beautiful!'], ['သာဓု သာဓု သာဓု', 'Sadhu, sadhu, sadhu!']];
export const JUDGED: Line = ['ဒိုင်လူကြီးများ အမှတ်ပေးပြီ', 'The judges have given their score.'];
