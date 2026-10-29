// The people who sell food at the fair, what they sell and what they talk about, in Myanmar with English.
// Food Street carts are in CARTS order (the same order as SNACKS); the pwe stalls follow PWE_FOOD.

export type Line = [string, string];
export interface MenuItem { id: string; name: string; my: string; p: number; d: string; ask: Line; serve: Line }
export interface Topic { q: Line; a: Line }
export interface Shop { who: string; whoMy: string; hello: Line[]; menu: MenuItem[]; topics: Topic[]; bye: Line }

const COUNT = ['', 'တစ်', 'နှစ်', 'သုံး', 'လေး', 'ငါး', 'ခြောက်', 'ခုနစ်', 'ရှစ်', 'ကိုး'];
/** “two cups of pawk seint”, the Burmese way: ပေါ့ဆိမ့် နှစ်ခွက် */
export const countMy = (my: string, n: number, cl = 'ခု') => `${my} ${COUNT[n] || mmNum(n)}${cl}`;
/** 1,300 -> ၁,၃၀၀ */
export const mmNum = (n: number) => n.toLocaleString('en-US').replace(/\d/g, d => '၀၁၂၃၄၅၆၇၈၉'[+d]);
export const kyatMy = (n: number) => `${mmNum(n)} ကျပ်`;

const item = (id: string, name: string, my: string, p: number, d: string, ask: Line, serve: Line): MenuItem => ({ id, name, my, p, d, ask, serve });

export const SHOPS: Shop[] = [
  { // mohinga
    who: 'Daw Khin Myint, mohinga seller', whoMy: 'မုန့်ဟင်းခါးသည် ဒေါ်ခင်မြင့်',
    hello: [['လာပါ လာပါ၊ မုန့်ဟင်းခါး ပူပူနွေးနွေးလေး ရမယ်နော်', 'Come, come! Hot mohinga, piping hot.'], ['ထိုင်ပါ ထိုင်ပါ၊ ဘာထည့်ပေးရမလဲ', 'Sit down, sit down. What shall I put in for you?']],
    menu: [
      item('mohinga', 'Mohinga', 'မုန့်ဟင်းခါး', 1000, 'Rice noodles in a thick fish and lemongrass broth, with banana stem, lime and coriander.', ['မုန့်ဟင်းခါး တစ်ပွဲ ပေးပါ', 'One mohinga, please.'], ['ရပြီနော်၊ သံပုရာ ညှစ်ပြီး စားပါ', 'Here you go. Squeeze some lime on it.']),
      item('mohinga_bk', 'Mohinga with split-pea fritters', 'မုန့်ဟင်းခါး ပဲကြော်နဲ့', 1300, 'The same bowl with crunchy split-pea fritters broken on top.', ['ပဲကြော်နဲ့ တစ်ပွဲ ပေးပါ', 'One with split-pea fritters, please.'], ['ပဲကြော် နှစ်ခု ထည့်ပေးထားတယ်', 'I put two fritters in for you.']),
      item('mohinga_egg', 'Mohinga with boiled duck egg', 'မုန့်ဟင်းခါး ဘဲဥနဲ့', 1300, 'With half a boiled duck egg, the way the Yangon morning crowd likes it.', ['ဘဲဥနဲ့ တစ်ပွဲ ပေးပါ', 'One with duck egg, please.'], ['ဘဲဥ အပြည့် ထည့်ပေးတယ်နော်', 'A whole egg for you.']),
    ],
    topics: [
      { q: ['စပ်လား', 'Is it spicy?'], a: ['မစပ်ပါဘူး၊ ငရုတ်သီးမှုန့် သီးသန့်ပေးမယ်၊ ကြိုက်သလောက် ထည့်စား', 'Not at all. I give chilli powder on the side, add as much as you like.'] },
      { q: ['ဒီဆိုင် ဘယ်လောက်ကြာပြီလဲ', 'How long have you had this stall?'], a: ['အနှစ်နှစ်ဆယ် ရှိပြီ၊ အမေ့ဆီက အမွေရတဲ့ ချက်နည်းပါ', 'Twenty years. It’s my mother’s recipe.'] },
      { q: ['ညဘက်လည်း မုန့်ဟင်းခါး စားကြလား', 'Do people eat mohinga at night too?'], a: ['စားတာပေါ့၊ ပွဲတော်ညဆို မနက်ထက်တောင် ရောင်းကောင်းတယ်', 'Of course! On a festival night it sells even better than in the morning.'] },
    ],
    bye: ['ကျေးဇူးပါ၊ နောက်လည်း လာခဲ့ဦးနော်', 'Thank you, come again!'],
  },
  { // mont lin ma yar
    who: 'U Aung, mont lin ma yar maker', whoMy: 'မုန့်လင်မယားသည် ဦးအောင်',
    hello: [['မုန့်လင်မယား ပူပူလေး၊ ငုံးဥနဲ့လား ပဲနဲ့လား', 'Hot mont lin ma yar! With quail egg or with chickpeas?']],
    menu: [
      item('mlmy', 'Mont lin ma yar (plain)', 'မုန့်လင်မယား', 500, 'Little rice-flour cups cooked in a pan of round moulds, pressed together in pairs.', ['ရိုးရိုး တစ်စုံ ပေးပါ', 'One set, plain please.'], ['ပူတယ်နော်၊ ဖြည်းဖြည်းစား', 'Careful, it’s hot. Eat slowly.']),
      item('mlmy_egg', 'Mont lin ma yar with quail egg', 'မုန့်လင်မယား ငုံးဥနဲ့', 700, 'A quail egg cracked into every cup.', ['ငုံးဥနဲ့ တစ်စုံ ပေးပါ', 'One with quail egg, please.'], ['ငုံးဥ တစ်ခွက်ကို တစ်လုံးစီ ထည့်ပေးတယ်', 'One quail egg in every cup.']),
      item('mlmy_pea', 'Mont lin ma yar with chickpeas', 'မုန့်လင်မယား ပဲနဲ့', 600, 'With boiled chickpeas and spring onion.', ['ပဲနဲ့ ကြက်သွန်မြိတ်နဲ့ ပေးပါ', 'With chickpeas and spring onion, please.'], ['ရပြီ၊ ကြက်သွန်မြိတ် များများ ထည့်ပေးထားတယ်', 'There you go, extra spring onion.']),
    ],
    topics: [
      { q: ['ဘာလို့ မုန့်လင်မယားလို့ ခေါ်တာလဲ', 'Why is it called “husband and wife”?'], a: ['အခြမ်းနှစ်ခြမ်း ပူးထားတော့ လင်နဲ့မယားလိုပဲ ခွဲလို့မရဘူးလေ', 'Two halves stuck together, like a husband and wife. You can’t pull them apart!'] },
      { q: ['ဘယ်လို လုပ်တာလဲ', 'How do you make it?'], a: ['ဆန်မှုန့်ကို ညကတည်းက စိမ်ထားရတယ်၊ ပြီးရင် ဒယ်အိုးတွင်းတွေထဲ လောင်းပြီး ဖုတ်တာ', 'The rice flour soaks from the night before, then I pour it into the little moulds and cook it.'] },
    ],
    bye: ['သွားတော့မလား၊ ပျော်ပျော်နေနော်', 'Off you go? Have fun!'],
  },
  { // shwe yin aye
    who: 'Ma Thida, shwe yin aye seller', whoMy: 'ရွှေရင်အေးသည် မသီတာ',
    hello: [['ရွှေရင်အေး အေးအေးလေး၊ ပူတဲ့ညမှာ အကောင်းဆုံး', 'Ice-cold shwe yin aye, the best thing on a warm night.']],
    menu: [
      item('shweyinaye', 'Shwe yin aye', 'ရွှေရင်အေး', 1200, 'Coconut milk with sago, agar jelly, sticky rice and a slice of bread over shaved ice.', ['ရွှေရင်အေး တစ်ခွက် ပေးပါ', 'One shwe yin aye, please.'], ['ရေခဲ များများ ထည့်ပေးထားတယ်', 'I added plenty of ice.']),
      item('falooda', 'Falooda', 'ဖာလူဒါ', 1500, 'Rose syrup, milk, jelly, basil seeds and a scoop of ice cream on top.', ['ဖာလူဒါ တစ်ခွက် ပေးပါ', 'One falooda, please.'], ['ရေခဲမုန့် တစ်လုံး ထပ်တင်ပေးတယ်', 'An extra scoop of ice cream on top.']),
    ],
    topics: [
      { q: ['ဘယ်ဟာ ပိုချိုလဲ', 'Which one is sweeter?'], a: ['ဖာလူဒါက ပိုချိုတယ်၊ ရွှေရင်အေးက အုန်းနို့ နံ့လေးနဲ့ ကြည်ကြည်လင်လင်', 'Falooda is sweeter. Shwe yin aye is lighter, with that coconut milk taste.'] },
      { q: ['ရေခဲ ဘယ်ကရလဲ', 'Where does the ice come from?'], a: ['ညနေကတည်းက ရေခဲတုံးကြီး ဝယ်ထားတာ၊ ပြီးမှ ခြစ်ပေးတာ', 'I buy a big block in the afternoon and shave it as I go.'] },
    ],
    bye: ['အေးအေးဆေးဆေး သောက်သွားနော်', 'Enjoy it slowly!'],
  },
  { // laphet thoke
    who: 'Daw Nu, salad seller', whoMy: 'အသုပ်သည် ဒေါ်နု',
    hello: [['လက်ဖက်သုပ် စားမလား၊ ပဲကြော် ကြွပ်ကြွပ်လေးနဲ့', 'Tea leaf salad? With nice crunchy fried beans.']],
    menu: [
      item('laphet', 'Laphet thoke', 'လက်ဖက်သုပ်', 1000, 'Pickled tea leaves mixed with fried beans, peanuts, sesame, garlic, tomato and chilli.', ['လက်ဖက်သုပ် တစ်ပွဲ ပေးပါ', 'One tea leaf salad, please.'], ['သုပ်ပေးပြီ၊ မြည်းကြည့်', 'All mixed. Have a taste.']),
      item('gyin', 'Ginger salad', 'ဂျင်းသုပ်', 900, 'Shredded pickled ginger with fried beans, sesame and lime.', ['ဂျင်းသုပ် တစ်ပွဲ ပေးပါ', 'One ginger salad, please.'], ['ဂျင်းက ဗိုက်အတွက် ကောင်းတယ်', 'Ginger is good for the stomach.']),
      item('khayan', 'Tomato salad', 'ခရမ်းချဉ်သီးသုပ်', 800, 'Ripe tomatoes with peanuts, onion, fish sauce and roasted chickpea powder.', ['ခရမ်းချဉ်သီးသုပ် ပေးပါ', 'Tomato salad, please.'], ['ပဲမှုန့် များများ ထည့်ထားတယ်', 'Extra chickpea powder for you.']),
    ],
    topics: [
      { q: ['စပ်စပ် လုပ်ပေးလို့ရလား', 'Can you make it extra spicy?'], a: ['ရတာပေါ့၊ ငရုတ်သီးစိမ်း နှစ်တောင့် ထပ်ထည့်ပေးမယ်', 'Sure, I’ll add two more green chillies.'] },
      { q: ['လက်ဖက်စားရင် အိပ်ပျော်ပါ့မလား', 'Will the tea leaves keep me awake?'], a: ['မပျော်လည်း ကောင်းတာပေါ့၊ မီးပန်း ကြည့်ရမှာလေ', 'Good, you need to stay up for the fireworks!'] },
      { q: ['လက်ဖက် ဘယ်ကလဲ', 'Where are the tea leaves from?'], a: ['ရှမ်းပြည်က နမ့်ဆန်လက်ဖက်ပါ', 'Namhsan, in Shan State.'] },
    ],
    bye: ['ကျေးဇူးပါ ကလေးရေ', 'Thank you, dear!'],
  },
  { // sugarcane juice
    who: 'Ko Zaw, sugarcane juice man', whoMy: 'ကြံရည်ဆိုင် ကိုဇော်',
    hello: [['ကြံရည် အေးအေးလေး၊ အခုပဲ ကြိတ်ပေးမယ်', 'Cold sugarcane juice, I’ll press it right now.']],
    menu: [
      item('kyan', 'Sugarcane juice', 'ကြံရည်', 600, 'Pressed fresh through the roller while you wait, poured over ice.', ['ကြံရည် တစ်ခွက် ပေးပါ', 'One sugarcane juice, please.'], ['ရော့၊ ရေခဲနဲ့ အေးအေးလေး', 'Here, nice and cold.']),
      item('kyan_lime', 'Sugarcane juice with lime', 'ကြံရည် သံပုရာနဲ့', 700, 'With a squeeze of lime and a pinch of salt.', ['သံပုရာနဲ့ တစ်ခွက် ပေးပါ', 'One with lime, please.'], ['သံပုရာ ညှစ်ပြီး ဆားနည်းနည်း ထည့်ထားတယ်', 'Lime and a little salt in it.']),
      item('kyan_big', 'Sugarcane juice, big cup', 'ကြံရည် ခွက်ကြီး', 900, 'The big cup, for when the night is hot.', ['ခွက်ကြီး တစ်ခွက် ပေးပါ', 'A big cup, please.'], ['ခွက်ကြီး ပြည့်ပြည့်လေး', 'A big one, filled to the top.']),
    ],
    topics: [
      { q: ['လတ်ဆတ်လား', 'Is it fresh?'], a: ['စက်နဲ့ အခုပဲ ကြိတ်ပေးတာ၊ ကြည့်ထား', 'I press it in the machine right in front of you. Watch!'] },
      { q: ['ကြံ ဘယ်ကလဲ', 'Where is the sugarcane from?'], a: ['ပဲခူးဘက်က ကြံခင်းကပါ', 'From the cane fields near Bago.'] },
    ],
    bye: ['ပျော်ပျော်နေ၊ မီးပန်း ကြည့်ဖို့ မမေ့နဲ့နော်', 'Have fun, and don’t miss the fireworks!'],
  },
  { // barbecue
    who: 'Ko Htet, barbecue stall', whoMy: 'အကင်ဆိုင် ကိုထက်',
    hello: [['အကင် ပူပူလေး၊ ကြိုက်တာ ရွေးပြီး ခြင်းထဲ ထည့်ပါ', 'Hot skewers! Pick what you like and put it in the basket.']],
    menu: [
      item('bbq', 'Chicken skewers', 'ကြက်သားအကင်', 800, 'Marinated chicken grilled over charcoal, 19th Street style.', ['ကြက်သားအကင် သုံးချောင်း ကင်ပေးပါ', 'Three chicken skewers, please.'], ['ကင်ပြီးပြီ၊ ငရုတ်သီးချဉ်နဲ့ စား', 'Done! Eat it with the chilli sauce.']),
      item('bbq_veg', 'Okra and tofu skewers', 'ရုံးပတီ တို့ဟူး အကင်', 600, 'Okra, tofu and a little mushroom, brushed with oil and garlic.', ['ရုံးပတီနဲ့ တို့ဟူး ကင်ပေးပါ', 'Okra and tofu, please.'], ['ကြက်သွန်ဖြူ ဆီ သုတ်ပေးထားတယ်', 'Brushed with garlic oil.']),
      item('bbq_fish', 'Fish ball skewers', 'ငါးဖယ်လုံး အကင်', 700, 'Bouncy fish balls, grilled until they puff up.', ['ငါးဖယ်လုံး ကင်ပေးပါ', 'Fish balls, please.'], ['ဖောင်းလာပြီ၊ ယူတော့', 'They’ve puffed up, take them!']),
    ],
    topics: [
      { q: ['ဆော့စ် ဘာရှိလဲ', 'What sauces do you have?'], a: ['ငရုတ်သီးချဉ် အနီ နဲ့ အစိမ်း ရှိတယ်၊ အစိမ်းက ပိုစပ်တယ်', 'Red and green chilli sauce. The green one is hotter.'] },
      { q: ['ဘယ်လောက်ကြာမလဲ', 'How long will it take?'], a: ['ငါးမိနစ်လောက်ပဲ၊ မီးကောင်းနေတယ်', 'About five minutes. The charcoal is nice and hot.'] },
    ],
    bye: ['နောက်လည်း လာခဲ့နော်၊ ဘီယာ မပါဘူးနော်', 'Come back again. No beer here though!'],
  },
];

export const PWE_SHOPS: Shop[] = [
  { // banana fritters
    who: 'Daw Hla, fritter seller', whoMy: 'အကြော်သည် ဒေါ်လှ',
    hello: [['ငှက်ပျောကြော် ပူပူလေး၊ ဒယ်အိုးထဲက အခုပဲ ဆယ်တာ', 'Hot banana fritters, just out of the pan!']],
    menu: [
      item('banana', 'Banana fritters', 'ငှက်ပျောကြော်', 500, 'Sweet bananas pressed flat, dipped in rice-flour batter and fried golden and crisp.', ['ငှက်ပျောကြော် သုံးခု ပေးပါ', 'Three banana fritters, please.'], ['ပူတယ်နော်၊ စက္ကူအိတ်နဲ့ ထည့်ပေးမယ်', 'They’re hot, I’ll put them in a paper bag.']),
      item('buthi', 'Gourd fritters', 'ဘူးသီးကြော်', 500, 'Long strips of bottle gourd in crisp batter, with a sour tamarind dip.', ['ဘူးသီးကြော် ပေးပါ', 'Gourd fritters, please.'], ['မန်ကျည်းရည်နဲ့ တို့စား', 'Dip them in the tamarind sauce.']),
      item('kyethun', 'Onion fritters', 'ကြက်သွန်ကြော်', 500, 'Crunchy onion fritters, the best thing with a cup of tea.', ['ကြက်သွန်ကြော် ပေးပါ', 'Onion fritters, please.'], ['ကြွပ်ကြွပ်လေး၊ အရသာရှိတယ်', 'Nice and crunchy.']),
    ],
    topics: [
      { q: ['ဘာဆီနဲ့ ကြော်တာလဲ', 'What oil do you fry in?'], a: ['ပဲဆီ သန့်သန့်နဲ့ပါ၊ ညတိုင်း ဆီအသစ် လဲတယ်', 'Clean peanut oil. I change it every night.'] },
      { q: ['ဘယ်ဟာ အရောင်းရဆုံးလဲ', 'Which sells the most?'], a: ['ငှက်ပျောကြော်ပေါ့၊ ကလေးတွေ အရမ်းကြိုက်တယ်', 'Banana fritters, the children love them.'] },
    ],
    bye: ['ကျေးဇူးပါ၊ ပွဲကြည့် ပျော်ပါစေ', 'Thank you, enjoy the pwe!'],
  },
  { // mont lone yay paw
    who: 'Ma Su, mont lone yay paw maker', whoMy: 'မုန့်လုံးရေပေါ်သည် မစု',
    hello: [['မုန့်လုံးရေပေါ် ပူပူလေး၊ ထန်းလျက်ချိုချိုလေးနဲ့', 'Warm mont lone yay paw, with sweet jaggery inside.']],
    menu: [
      item('monlone', 'Mont lone yay paw', 'မုန့်လုံးရေပေါ်', 500, 'Sticky rice balls with a melting jaggery centre, rolled in fresh coconut. A Thingyan favourite.', ['ငါးလုံး ပေးပါ', 'Five, please.'], ['ထန်းလျက်က ပူတယ်နော်၊ တစ်လုံးလုံး ပါးစပ်ထဲ ထည့်စား', 'The jaggery is hot, pop the whole ball in your mouth.']),
      item('montlatsaung', 'Mont let saung', 'မုန့်လက်ဆောင်း', 700, 'Cool coconut milk with jaggery syrup, sago and rice noodles.', ['မုန့်လက်ဆောင်း တစ်ခွက် ပေးပါ', 'One mont let saung, please.'], ['အေးအေးလေး သောက်', 'Nice and cool.']),
    ],
    topics: [
      { q: ['သင်္ကြန်မှာ စားတဲ့ မုန့်မလား', 'Isn’t this the Thingyan snack?'], a: ['ဟုတ်တယ်၊ သင်္ကြန်မှာ တချို့ထဲ ငရုတ်သီး ထည့်ပြီး စနောက်ကြတယ်', 'Yes! At Thingyan people hide a chilli in some of them as a joke.'] },
      { q: ['ဒီထဲမှာ ငရုတ်သီး ပါလား', 'Is there a chilli in these?'], a: ['မပါပါဘူး၊ ဒီည ချိုချိုလေးပဲ', 'No, tonight they’re all sweet, I promise.'] },
    ],
    bye: ['ချိုချိုမြိန်မြိန် စားသွားနော်', 'Enjoy them!'],
  },
  { // tofu
    who: 'Nang Seng, Shan tofu seller', whoMy: 'ရှမ်းတို့ဟူးသည် နန်းစိုင်း',
    hello: [['ရှမ်းတို့ဟူးကြော် ပူပူလေး၊ မန်ကျည်းရည် ချဉ်ချဉ်စပ်စပ်နဲ့', 'Hot Shan tofu fritters, with a sour and spicy tamarind dip.']],
    menu: [
      item('tohu', 'Shan tofu fritters', 'တို့ဟူးကြော်', 600, 'Golden yellow chickpea tofu fried crisp.', ['တို့ဟူးကြော် တစ်ပွဲ ပေးပါ', 'One plate of tofu fritters, please.'], ['ရပြီ၊ မန်ကျည်းရည်နဲ့ တို့စား', 'Here, dip them in the tamarind.']),
      item('tohunway', 'Warm tofu noodles', 'တို့ဟူးနွေး', 800, 'Rice noodles under a warm, silky chickpea tofu soup with chilli oil.', ['တို့ဟူးနွေး တစ်ပွဲ ပေးပါ', 'One warm tofu noodles, please.'], ['ငရုတ်ဆီ နည်းနည်း ဆမ်းပေးထားတယ်', 'A little chilli oil on top.']),
    ],
    topics: [
      { q: ['ပဲပုပ်နဲ့ လုပ်တာလား', 'Is it made of soybeans?'], a: ['မဟုတ်ဘူး၊ ကုလားပဲမှုန့်နဲ့ လုပ်တာ၊ ရှမ်းပြည် စတိုင်', 'No, from chickpea flour. Shan style.'] },
      { q: ['ဘယ်ကလာတာလဲ', 'Where are you from?'], a: ['တောင်ကြီးကပါ၊ ပွဲတော်တိုင်း ရန်ကုန် ဆင်းလာတယ်', 'From Taunggyi. I come down to Yangon for every festival.'] },
    ],
    bye: ['နောက်တစ်ခေါက် တို့ဟူးနွေးလည်း စားကြည့်နော်', 'Next time, try the warm tofu noodles!'],
  },
];

// ---- the teashop (လက်ဖက်ရည်ဆိုင်): a waiter takes your order at the table and brings it over
export interface TeaItem { id: string; name: string; my: string; p: number; d: string; kind: 'drink' | 'food'; cl?: string }
export const TEA_MENU: TeaItem[] = [
  { id: 'pawkseint', cl: 'ခွက်', name: 'Tea, light and milky', my: 'ပေါ့ဆိမ့်', p: 500, kind: 'drink', d: 'Less tea, more milk. Gentle and sweet.' },
  { id: 'choseint', cl: 'ခွက်', name: 'Tea, sweet and creamy', my: 'ချိုဆိမ့်', p: 500, kind: 'drink', d: 'Extra condensed milk, extra sweet.' },
  { id: 'kyaseint', cl: 'ခွက်', name: 'Tea, strong and creamy', my: 'ကျဆိမ့်', p: 500, kind: 'drink', d: 'Strong, dark tea with plenty of milk.' },
  { id: 'kopi', cl: 'ခွက်', name: 'Coffee mix', my: 'ကော်ဖီ', p: 400, kind: 'drink', d: 'Sweet instant coffee in a glass.' },
  { id: 'palata', cl: 'ချပ်', name: 'Palata with sugar', my: 'ပလာတာ သကြားနဲ့', p: 600, kind: 'food', d: 'Flaky fried flatbread sprinkled with sugar.' },
  { id: 'palata_egg', cl: 'ချပ်', name: 'Egg palata', my: 'ကြက်ဥပလာတာ', p: 800, kind: 'food', d: 'Flatbread folded around a fried egg.' },
  { id: 'nanbya', cl: 'ချပ်', name: 'Naan with boiled peas', my: 'နံပြား ပဲပြုတ်', p: 700, kind: 'food', d: 'Fresh tandoor naan with buttery boiled peas.' },
  { id: 'ekyakway', cl: 'ချောင်း', name: 'Fried dough sticks', my: 'အီကြာကွေး', p: 300, kind: 'food', d: 'Dip them in your tea.' },
  { id: 'samusa', cl: 'ခု', name: 'Samosa', my: 'ဆမူဆာ', p: 300, kind: 'food', d: 'Crisp triangles filled with spiced potato.' },
  { id: 'paukzi', cl: 'လုံး', name: 'Steamed bun', my: 'ပေါက်စီ', p: 500, kind: 'food', d: 'Soft bun filled with chicken and egg.' },
  { id: 'nangyi', cl: 'ပွဲ', name: 'Nan gyi thoke', my: 'နန်းကြီးသုပ်', p: 1000, kind: 'food', d: 'Thick rice noodles with chicken curry and chickpea powder.' },
];
export const WAITER = {
  hello: [['ဘာသုံးဆောင်မလဲ ခင်ဗျာ', 'What would you like?'], ['ရေနွေးကြမ်း အရင် ချပေးထားမယ်နော်', 'I’ll put the green tea down first.']] as Line[],
  confirm: (list: string) => [`ဟုတ်ကဲ့၊ ${list} နော်။ ခဏလေး စောင့်ပေးပါ`, 'Okay! Just a moment.'] as Line,
  serve: ['ရပါပြီ ခင်ဗျာ၊ သုံးဆောင်ပါ', 'Here you are. Enjoy!'] as Line,
  more: ['ဘာထပ်ယူဦးမလဲ ခင်ဗျာ', 'Anything else?'] as Line,
  bill: (n: number) => [`စုစုပေါင်း ${kyatMy(n)} ပါ ခင်ဗျာ`, `That comes to ${n.toLocaleString('en-US')} Ks.`] as Line,
  thanks: ['ကျေးဇူးတင်ပါတယ်၊ နောက်လည်း လာခဲ့ပါဦး', 'Thank you, please come again!'] as Line,
  short: ['ပိုက်ဆံ မလောက်ဘူးလား၊ ဦးလေးဆီ သွားတောင်းကြည့်ပါ', 'Not enough money? Ask Uncle by the gate.'] as Line,
  topics: [
    { q: ['ဘောလုံးပွဲ ဘယ်သူနိုင်နေလဲ', 'Who’s winning the football?'], a: ['မန်ယူ တစ်ဂိုး ရှေ့ကနေတယ် ခင်ဗျ၊ ဒုတိယပိုင်း ရှိသေးတယ်', 'Man United are one up. There’s still the second half.'] },
    { q: ['ဒီဆိုင်မှာ ဘာအကောင်းဆုံးလဲ', 'What’s best here?'], a: ['ပလာတာနဲ့ ပေါ့ဆိမ့်ပေါ့ ခင်ဗျ၊ ဒီဆိုင်ရဲ့ နာမည်ကြီး', 'Palata with a pawk seint. That’s what we’re known for.'] },
    { q: ['ရေနွေးကြမ်း ထပ်ပေးပါ', 'More green tea, please.'], a: ['ဟုတ်ကဲ့၊ ရေနွေးကြမ်းက အလကားပါ၊ ကြိုက်သလောက် သောက်', 'Sure, green tea is free. Drink as much as you like.'] },
    { q: ['ဆိုင် ဘယ်နှနာရီ ပိတ်လဲ', 'When do you close?'], a: ['ပွဲတော်ညဆို မနက်အထိ ဖွင့်တယ် ခင်ဗျ', 'On a festival night we stay open until morning.'] },
  ] as Topic[],
  call: ['ညီလေး', 'Waiter! (literally “little brother”)'] as Line,
  pay: ['ညီလေး၊ ပိုက်ဆံရှင်းမယ်', 'Waiter, the bill please.'] as Line,
};

// ---- what people say depends on where they are: overheard in the crowd near each zone (text bubbles, no voice)
export const LOCAL_LINES: Record<string, Line[]> = {
  ferris: [['အပေါ်ဆုံးရောက်ရင် ရွှေတိဂုံ မြင်ရတယ်', 'From the top you can see Shwedagon'], ['ငါ ကြောက်တယ်၊ နင် အရင်စီး', 'I’m scared, you go first'], ['လက်မှတ် ဘယ်လောက်လဲ', 'How much is a ticket?']],
  carousel: [['သမီးလေး၊ မြင်းဖြူလေး စီးမလား', 'Want to ride the white horse, sweetie?'], ['နောက်တစ်ပတ် ထပ်စီးချင်တယ်', 'I want another go!']],
  food: [['မုန့်ဟင်းခါး တစ်ပွဲ ထပ်စားမယ်', 'I’ll have another bowl of mohinga'], ['ဒီဆိုင် ငရုတ်သီး စပ်တယ်ဟေ့', 'This stall’s chilli is hot!'], ['ကြံရည် ခွက်ကြီး ယူမလား', 'Shall we get a big sugarcane juice?'], ['ထိုင်ခုံ လွတ်တာ ရှိလား', 'Is there a free stool?']],
  pirate: [['နောက်ဆုံးခုံမှာ ထိုင်ရအောင်', 'Let’s sit in the back row'], ['ဗိုက်ထဲ ပျို့လာပြီ', 'My stomach is flipping!']],
  games: [['ကွင်းက ပုလင်းပေါ် မကျဘူး', 'The ring won’t land on the bottle'], ['ဆင်ဖြူရုပ်ကြီး ရချင်တယ်', 'I want the big white elephant'], ['နောက်တစ်ခါ ထပ်ပစ်မယ်', 'One more throw!']],
  kids: [['ရထားလေး လာပြီ', 'The little train is coming!'], ['ပစ်တိုင်းထောင် ဝယ်ပေး', 'Buy me a tumbling doll'], ['လက်ကိုင်ထားနော်၊ ပျောက်သွားမယ်', 'Hold my hand or you’ll get lost']],
  music: [['ဆိုင်းသံ ကြားရတာ ကြည်နူးစရာ', 'I love hearing the saing waing'], ['ကချေသည် ကတာ လှလိုက်တာ', 'The dancer is so graceful'], ['ဓာတ်ပုံတစ်ပုံ ရိုက်ပေးပါလား', 'Could you take our photo?']],
  finale: [['ဒီနေရာက မီးပန်း အကြည့်ကောင်းဆုံး', 'This is the best spot for the fireworks'], ['ကိုးနာရီခွဲ ရောက်ပြီလား', 'Is it half past nine yet?']],
  midway: [['ကားတိုက်တာ နောက်တစ်ပွဲ စီးမယ်', 'One more round of bumper cars'], ['ကောင်လေးတွေ ချားကို လက်နဲ့ လှည့်နေတာ ကြည့်', 'Look, the boys turn the wheel by hand'], ['ငှက်ပျောကြော် ဝယ်မလား', 'Shall we get banana fritters?']],
  candles: [['ဆီမီးလေး ထွန်းပြီး ဆုတောင်းရအောင်', 'Let’s light a lamp and make a wish'], ['ပန်းကပ်ဖို့ စံပယ်ပန်း ဝယ်ခဲ့', 'I bought jasmine to offer'], ['တိတ်တိတ်လေး နေနော်', 'Let’s keep our voices down']],
  teashop: [['ညီလေး၊ ပေါ့ဆိမ့် တစ်ခွက်', 'Waiter, one pawk seint!'], ['ဂိုး! ဂိုး!', 'Goal! Goal!'], ['ပလာတာ ထပ်မှာမယ်', 'Let’s order another palata'], ['ဒီည ဘယ်သူ ပိုက်ဆံရှင်းမလဲ', 'Who’s paying tonight?']],
  lake: [['မီးပုံးလေးတွေ ရေပေါ် မျောနေတာ လှလိုက်တာ', 'The lanterns floating on the water are lovely'], ['ငါ့ဆုတောင်း ဘာလဲ မပြောပြဘူး', 'I’m not telling you my wish']],
  street: [['လမ်းဘေး ရောင်းတာတွေ အများကြီးပဲ', 'So many street sellers'], ['ဆိုက်ကား စီးပြီး ပြန်မယ်', 'We’ll take a trishaw home'], ['လူကျပ်တယ်၊ ဖြည်းဖြည်းလျှောက်', 'It’s crowded, walk slowly']],
};
