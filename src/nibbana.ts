// The Tazaungdaing side of the fair: the Nibbana market (နိဗ္ဗာန်ဈေး), where families give food and things away
// for merit and nothing is sold, and the grounds next to it with the robe-weaving contest, the money tree and a chinlone circle.
import type { Line, MenuItem, Topic } from './shops';

export interface Giving {
  id: string; who: string; whoMy: string; banner: [string, string]; col: string;
  kind: 'pot' | 'tea' | 'salad' | 'rice' | 'fruit' | 'water' | 'thanaka' | 'flowers';
  hello: Line[]; gifts: MenuItem[]; topics: Topic[];
}
const gift = (id: string, name: string, my: string, d: string, ask: Line, serve: Line): MenuItem => ({ id, name, my, p: 0, d, ask, serve });

// what every donor is asked, and the answers you hear at any Nibbana market
const WHY: Topic = { q: ['ဘာလို့ နိဗ္ဗာန်ဈေးလို့ ခေါ်တာလဲ', 'Why is it called the Nibbana market?'],
  a: ['ဈေးလို လာယူရပေမယ့် ပိုက်ဆံ မပေးရဘူးလေ။ ပေးတဲ့သူက ကုသိုလ်ရ၊ ယူတဲ့သူက ဝမ်းသာ။ ဒါကြောင့် နိဗ္ဗာန်ဈေးလို့ ခေါ်တာ', 'You take things like at a market, but nobody pays. The giver gains merit and the one who takes is happy. That’s why we call it the Nibbana market.'] };
const WHO: Topic = { q: ['ဘယ်သူတွေ လှူကြတာလဲ', 'Who is giving all this?'],
  a: ['ရပ်ကွက်ထဲက မိသားစုတွေ ငွေစုပြီး လှူကြတာ။ တန်ဆောင်တိုင်ရောက်ရင် နှစ်တိုင်း လုပ်တယ်', 'Families from our ward pool their money and give. We do it every year at Tazaungdaing.'] };

export const GIVINGS: Giving[] = [
  { id: 'nib_mohinga', kind: 'pot', col: '#c2543a', who: 'Daw San San’s family', whoMy: 'ဒေါ်စန်းစန်း မိသားစု', banner: ['မုန့်ဟင်းခါး အလှူ', 'Free mohinga'],
    hello: [['ဝင်ခဲ့ကြပါ ဝင်ခဲ့ကြပါ၊ မုန့်ဟင်းခါး အခမဲ့ပါ', 'Come in, come in! The mohinga is free.'], ['တန်းစီပြီး တစ်ယောက် တစ်ပွဲနော်', 'Queue up, one bowl each.']],
    gifts: [gift('mohinga', 'Mohinga', 'မုန့်ဟင်းခါး', 'Fish noodle soup cooked since four in the afternoon in the family’s biggest pot.', ['တစ်ပွဲ ရနိုင်မလား', 'May I have a bowl?'], ['ယူပါ ယူပါ၊ ပူတယ်နော်၊ ဖြည်းဖြည်းစား', 'Here, take it. It’s hot, eat slowly.'])],
    topics: [WHY, { q: ['ဘယ်နှစ်ပွဲလောက် ချက်ထားလဲ', 'How many bowls did you cook?'], a: ['အိုး သုံးလုံး ချက်ထားတယ်။ ကုန်ရင် ထပ်ချက်မယ်', 'Three big pots. If it runs out we’ll cook more.'] }] },
  { id: 'nib_tea', kind: 'tea', col: '#7a4a2a', who: 'The ward youth group', whoMy: 'ရပ်ကွက် လူငယ်အဖွဲ့', banner: ['လက်ဖက်ရည် အလှူ', 'Free tea'],
    hello: [['အစ်ကို အစ်မ၊ လက်ဖက်ရည် သောက်သွားပါဦး', 'Brother, sister, have some tea before you go!']],
    gifts: [gift('nib_tea', 'Sweet milk tea', 'လက်ဖက်ရည်ချို', 'Strong tea and condensed milk, poured from high so it froths.', ['လက်ဖက်ရည် တစ်ခွက်လောက်', 'A cup of tea, please.'], ['ရော့၊ ချိုချိုလေး ဖျော်ပေးထားတယ်', 'Here you go, nice and sweet.']),
      gift('yaynway', 'Green tea', 'ရေနွေးကြမ်း', 'Plain hot green tea, always free.', ['ရေနွေးကြမ်း တစ်ခွက်', 'A cup of green tea.'], ['ယူပါ၊ ကြိုက်သလောက် ထပ်ထည့်', 'Take it, refill as much as you like.'])],
    topics: [WHO, { q: ['ညဘယ်အချိန်ထိ ရှိမလဲ', 'How late will you be here?'], a: ['မနက်မိုးလင်းထိပဲ၊ သင်္ကန်းရက်တဲ့သူတွေကိုလည်း လက်ဖက်ရည် ပို့ပေးရဦးမယ်', 'Till dawn. We also have to bring tea to the robe weavers.'] }] },
  { id: 'nib_mezali', kind: 'salad', col: '#5f7b2d', who: 'U Tin Maung and Daw Aye', whoMy: 'ဦးတင်မောင်နဲ့ ဒေါ်အေး', banner: ['မယ်ဇလီဖူးသုပ်', 'Mezali flower salad'],
    hello: [['တန်ဆောင်မုန်း လပြည့်ညမှ စားရတဲ့ မယ်ဇလီဖူးသုပ်လေ၊ လာစားပါ', 'Mezali flower salad, the one you only eat on Tazaungmon full moon night. Come and have some!']],
    gifts: [gift('mezali', 'Mezali flower salad', 'မယ်ဇလီဖူးသုပ်', 'Bitter mezali buds tossed with peanuts, sesame, fried garlic and lime. Eaten on Tazaungmon full moon night.', ['တစ်ပွဲလောက် မြည်းကြည့်မယ်', 'I’d like to try a plate.'], ['ယူပါ၊ နည်းနည်း ခါးတယ်နော်၊ ဒါပေမဲ့ ဆေးပဲ', 'Take it. It’s a little bitter, but it’s medicine.'])],
    topics: [{ q: ['ဘာလို့ ဒီညမှ စားကြတာလဲ', 'Why do people eat it tonight?'], a: ['တန်ဆောင်မုန်း လပြည့်ညမှာ မယ်ဇလီဖူးက ဆေးဖြစ်တယ်လို့ အဘိုးအဘွားတွေ ယုံကြတယ်။ ညသန်းခေါင်မတိုင်ခင် စားရတယ်', 'Our grandparents believed that on Tazaungmon full moon night the mezali flower turns into medicine. You eat it before midnight.'] }, WHY] },
  { id: 'nib_danbauk', kind: 'rice', col: '#d9932b', who: 'Ko Naing and friends', whoMy: 'ကိုနိုင်နဲ့ သူငယ်ချင်းများ', banner: ['ဒံပေါက် အလှူ', 'Free dan bauk'],
    hello: [['ဒံပေါက် ကုန်ခါနီးပြီ၊ မြန်မြန်လာ', 'The dan bauk’s nearly gone, come quick!']],
    gifts: [gift('danbauk', 'Chicken dan bauk', 'ကြက်သားဒံပေါက်', 'Spiced rice baked with chicken, served with a sour mint salad and a bowl of soup.', ['တစ်ပွဲ ရနိုင်မလား', 'Could I have a plate?'], ['ရော့၊ ချဉ်ရည်လေးပါ ထည့်ပေးထားတယ်', 'Here, I added the sour soup too.'])],
    topics: [WHO, { q: ['ဘယ်လောက် ချက်ထားလဲ', 'How much did you make?'], a: ['ဆန် အိတ်ဝက်လောက်။ ရုံးက သူငယ်ချင်းတွေ ငွေစုပြီး လှူတာ', 'About half a sack of rice. Friends from the office pooled their money.'] }] },
  { id: 'nib_fruit', kind: 'fruit', col: '#e0a526', who: 'Daw Mya Mya', whoMy: 'ဒေါ်မြမြ', banner: ['သစ်သီး အလှူ', 'Free fruit'],
    hello: [['ငှက်ပျောသီး ယူသွားပါ၊ အိမ်က ကလေးတွေအတွက်လည်း ယူသွား', 'Take some bananas, and some for the kids at home too.']],
    gifts: [gift('nib_fruit', 'Bananas and pomelo', 'ငှက်ပျောသီးနဲ့ ကျွဲကောသီး', 'A hand of small sweet bananas and a wedge of pomelo.', ['ငှက်ပျောသီး နည်းနည်း', 'A few bananas, please.'], ['ယူပါ၊ ကျွဲကောလည်း တစ်စိတ် ထည့်ပေးမယ်', 'Take them. I’ll add a piece of pomelo too.'])],
    topics: [WHY] },
  { id: 'nib_water', kind: 'water', col: '#2d7bb6', who: 'The taxi drivers of the ward', whoMy: 'ရပ်ကွက် တက္ကစီဆရာများ', banner: ['ရေအေး အလှူ', 'Free cold water'],
    hello: [['ရေအေးအေးလေး သောက်သွားပါ၊ ညဘက် လမ်းလျှောက်ရတာ မောတယ်', 'Have some cold water, all this walking is tiring!']],
    gifts: [gift('nib_water', 'Cold water and lime juice', 'ရေအေးနဲ့ သံပုရာရည်', 'Ice-cold drinking water, or sweet lime juice from a cooler box.', ['ရေတစ်ခွက်', 'A cup of water, please.'], ['ရော့၊ ရေခဲထည့်ထားတယ်', 'Here, with ice.'])],
    topics: [WHO, { q: ['တက္ကစီဆရာတွေက ဘာလို့ လှူတာလဲ', 'Why do taxi drivers give?'], a: ['တစ်နှစ်လုံး ခရီးသည်တွေကြောင့် စားရတာ၊ တစ်ညလောက် ပြန်ပေးချင်လို့ပါ', 'All year we earn from our passengers. For one night we want to give something back.'] }] },
  { id: 'nib_thanaka', kind: 'thanaka', col: '#c9a46a', who: 'Grandma Daw Thein', whoMy: 'အဘွား ဒေါ်သိန်း', banner: ['သနပ်ခါး အလှူ', 'Free thanaka'],
    hello: [['လာ မြေးလေး၊ သနပ်ခါး လိမ်းပေးမယ်', 'Come here, dear, let me put some thanaka on you.'], ['ရှင်မတောင် သနပ်ခါးစစ်စစ်၊ ကျောက်ပျဉ်ပေါ်မှာ အခုသွေးထားတာ', 'Real Shinmadaung thanaka, ground just now on the stone slab.']],
    gifts: [gift('thanaka', 'Thanaka on your cheeks', 'သနပ်ခါး', 'Fragrant bark paste ground on a stone slab, cool on the skin. Grandma draws it on your cheeks.', ['သနပ်ခါး လိမ်းပေးပါ', 'Please put some on me.'], ['ကဲ၊ ပါးမှာ ဝိုင်းဝိုင်းလေး၊ ချောသွားပြီ', 'There, a round patch on each cheek. Lovely.'])],
    topics: [{ q: ['သနပ်ခါးက ဘာအတွက်လဲ', 'What is thanaka for?'], a: ['နေပူကာတယ်၊ အေးတယ်၊ မွှေးတယ်။ နှစ်ပေါင်း နှစ်ထောင်လောက် လိမ်းလာကြတာ', 'It keeps the sun off, it’s cool and it smells nice. We’ve worn it for about two thousand years.'] }, WHY] },
  { id: 'nib_flowers', kind: 'flowers', col: '#e6b8c8', who: 'The monastery school children', whoMy: 'ဘုန်းကြီးကျောင်း ကလေးများ', banner: ['ပန်းနဲ့ ဖယောင်းတိုင်', 'Flowers and candles'],
    hello: [['စံပယ်ပန်းနဲ့ ဖယောင်းတိုင် ယူသွားပါ၊ စေတီမှာ ကပ်လှူလို့ရတယ်', 'Take some jasmine and a candle. You can offer them at the stupa.']],
    gifts: [gift('nib_flowers', 'Jasmine and a candle', 'စံပယ်ပန်းနဲ့ ဖယောင်းတိုင်', 'A string of jasmine and a small candle, to offer at the Candle Festival stupa.', ['ပန်းတစ်ကုံး ပေးပါ', 'A string of flowers, please.'], ['ရော့ပါ၊ ဆုတောင်းပြည့်ပါစေ', 'Here you are. May your wishes come true.'])],
    topics: [{ q: ['ဘယ်မှာ ကပ်လှူရမလဲ', 'Where should I offer them?'], a: ['ဆီမီးထွန်းပွဲက စေတီလေးမှာပေါ့၊ ဆုတောင်းကန်ရဲ့ အနောက်ဘက်မှာ', 'At the little stupa at the Candle Festival, west of the Wishing Lake.'] }, WHO] },
];

export const DONATE_SAY: Line[] = [['အလှူငွေ နည်းနည်း ထည့်ပါရစေ', 'Let me add a little to your offering.']];
export const SADHU: Line = ['သာဓု သာဓု သာဓု', 'Sadhu, sadhu, sadhu! (Well done!)'];
export const THANKS: Line = ['ကျေးဇူးပါ၊ အမျှ အမျှ အမျှ', 'Thank you! We share the merit with you.'];
export const BYE_ME: Line = ['သာဓုပါ၊ ကုသိုလ်ရပါစေ', 'Sadhu! May your merit grow.'];
export const BYE_THEM: Line[] = [['နောက်နှစ်လည်း လာခဲ့ဦးနော်', 'Come again next year!'], ['ကျန်းမာပါစေ', 'Stay well!'], ['ဗိုက်ဝအောင် စားသွားနော်', 'Eat till you’re full!']];

/** The matho thingan (မသိုးသင်္ကန်း) contest: the robe has to be woven in one night and offered at dawn. */
export const WEAVE_LINES: Line[] = [
  ['မနက် မိုးမလင်းခင် ပြီးရမယ်နော်', 'It has to be finished before dawn!'],
  ['ချည်မပြတ်အောင် သေချာလုပ်', 'Careful, don’t break the thread.'],
  ['လွန်းကို ညီညီ ပစ်', 'Throw the shuttle evenly.'],
  ['သာဓု၊ တစ်ကြောင်း ပြီးပြီ', 'Sadhu, one more row done!'],
];
