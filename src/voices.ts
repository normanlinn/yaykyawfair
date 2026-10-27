// Burmese voices for the crowd: short spoken lines made offline with eSpeak NG (Burmese voice), then muffled and echoed
// so they sit in the background like people talking across a busy street. See sounds/README.md.

import say0m from '../sounds/say0m.mp3';
import say0f from '../sounds/say0f.mp3';
import say1m from '../sounds/say1m.mp3';
import say1f from '../sounds/say1f.mp3';
import say2m from '../sounds/say2m.mp3';
import say2f from '../sounds/say2f.mp3';
import say3m from '../sounds/say3m.mp3';
import say3f from '../sounds/say3f.mp3';
import say4m from '../sounds/say4m.mp3';
import say4f from '../sounds/say4f.mp3';
import say5m from '../sounds/say5m.mp3';
import say5f from '../sounds/say5f.mp3';
import say6m from '../sounds/say6m.mp3';
import say6f from '../sounds/say6f.mp3';
import say7m from '../sounds/say7m.mp3';
import say7f from '../sounds/say7f.mp3';
import say8m from '../sounds/say8m.mp3';
import say8f from '../sounds/say8f.mp3';
import say9m from '../sounds/say9m.mp3';
import say9f from '../sounds/say9f.mp3';
import say10m from '../sounds/say10m.mp3';
import say10f from '../sounds/say10f.mp3';
import say11m from '../sounds/say11m.mp3';
import say11f from '../sounds/say11f.mp3';
import say12m from '../sounds/say12m.mp3';
import say12f from '../sounds/say12f.mp3';
import say13m from '../sounds/say13m.mp3';
import say13f from '../sounds/say13f.mp3';
import say14m from '../sounds/say14m.mp3';
import say14f from '../sounds/say14f.mp3';
import say15m from '../sounds/say15m.mp3';
import say15f from '../sounds/say15f.mp3';
import say16m from '../sounds/say16m.mp3';
import say16f from '../sounds/say16f.mp3';
import say17m from '../sounds/say17m.mp3';
import say17f from '../sounds/say17f.mp3';
import call0 from '../sounds/call0.mp3';
import call1 from '../sounds/call1.mp3';
import call2 from '../sounds/call2.mp3';
import call3 from '../sounds/call3.mp3';
import call4 from '../sounds/call4.mp3';
import call5 from '../sounds/call5.mp3';
import call6 from '../sounds/call6.mp3';

import rep0m from '../sounds/rep0m.mp3';
import rep0f from '../sounds/rep0f.mp3';
import rep1m from '../sounds/rep1m.mp3';
import rep1f from '../sounds/rep1f.mp3';
import rep2m from '../sounds/rep2m.mp3';
import rep2f from '../sounds/rep2f.mp3';
import rep3m from '../sounds/rep3m.mp3';
import rep3f from '../sounds/rep3f.mp3';
import rep4m from '../sounds/rep4m.mp3';
import rep4f from '../sounds/rep4f.mp3';

/** What the crowd says, in Myanmar with English. Index i is spoken by clips say{i}m and say{i}f. */
export const CROWD_LINES: Array<[string, string]> = [["ဒါ ဘယ်လောက်လဲ", "How much is this?"], ["စားလို့ကောင်းတယ်", "Delicious!"], ["ချားရဟတ် စီးချင်တယ်", "I want to ride the wheel"], ["မီးပန်း ဘယ်အချိန်လဲ", "When are the fireworks?"], ["ဟိုမှာ ကြည့်", "Look over there!"], ["အမေ၊ ပူဖောင်း ဝယ်ပေး", "Mum, buy me a balloon"], ["လာ၊ သွားကြရအောင်", "Come on, let’s go"], ["ညကြီး လှလိုက်တာ", "What a lovely night"], ["ကြံရည် သောက်မယ်", "I’ll get sugarcane juice"], ["စားပြီးပြီလား", "Have you eaten yet?"], ["ဗိုက်ဆာပြီ", "I’m hungry"], ["ပျော်စရာကြီးနော်", "This is so fun"], ["ဓာတ်ပုံ ရိုက်ရအောင်", "Let’s take a photo"], ["ကွင်းပစ် ကစားမလား", "Want to play ring toss?"], ["လူတွေ များလိုက်တာ", "So many people!"], ["မောင်လေး၊ လက်ကိုင်ထား", "Hold my hand, little one"], ["သီတင်းကျွတ် ပျော်ရွှင်ပါစေ", "Happy Thadingyut!"], ["ဆုတောင်း မီးပုံးပျံ လွှတ်ရအောင်", "Let’s send up a wish balloon"]];
/** What the snack sellers call out, in cart order (the last one is for anybody). Spoken by clip call{i}. */
export const VENDOR_CALLS: Array<[string, string]> = [["မုန့်ဟင်းခါး ပူပူလေး ရမယ်နော်", "Hot mohinga here!"], ["မုန့်လင်မယား ပူပူလေး", "Hot mont lin ma yar!"], ["ရွှေရင်အေး အေးအေးလေး", "Ice-cold shwe yin aye!"], ["လက်ဖက်သုပ် စားမလား", "Tea leaf salad?"], ["ကြံရည် အေးအေးလေး ရမယ်", "Cold sugarcane juice!"], ["အကင် ပူပူလေး လာဝယ်ပါ", "Hot skewers, come and buy!"], ["လာပါ လာပါ ဝယ်ပါ", "Come, come, buy!"]];
/** What people say back when you talk to them. Index i is spoken by clips rep{i}m and rep{i}f. */
export const REPLIES: Array<[string, string]> = [["မင်္ဂလာပါ၊ ပျော်ပျော်နေနော်", "Hello! Have fun tonight!"], ["နေကောင်းပါတယ်၊ ကျေးဇူးပဲ", "I'm well, thank you!"], ["မုန့်ဟင်းခါး စားကြည့်ပါ", "Try the mohinga!"], ["မီးပန်းကြည့်ရှုရာ ကုန်းမှာ ကြည့်ပါ", "Watch from the Finale View deck!"], ["ကားတိုက်တာ စီးကြည့်ပါ၊ ပျော်တယ်", "Try the bumper cars, they're fun!"]];
export const VOICE_CLIPS: Record<string, string> = { rep0m, rep0f, rep1m, rep1f, rep2m, rep2f, rep3m, rep3f, rep4m, rep4f, say0m, say0f, say1m, say1f, say2m, say2f, say3m, say3f, say4m, say4f, say5m, say5f, say6m, say6f, say7m, say7f, say8m, say8f, say9m, say9f, say10m, say10f, say11m, say11f, say12m, say12f, say13m, say13f, say14m, say14f, say15m, say15f, say16m, say16f, say17m, say17f, call0, call1, call2, call3, call4, call5, call6 };
