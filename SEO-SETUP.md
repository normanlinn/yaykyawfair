# Getting Yay Kyaw Nights on Google · Google မှာ ပေါ်လာအောင်

The code side is done: bilingual titles and descriptions, share previews, structured data, a readable `/about/` page, `robots.txt` and `sitemap.xml`. The steps below need the site owner's accounts, so only you can do them.

ကုဒ်ဘက်က လုပ်စရာတွေ (ခေါင်းစဉ်၊ ဖော်ပြချက်၊ `/about/` စာမျက်နှာ၊ `robots.txt`၊ `sitemap.xml`) ပြီးပါပြီ။ အောက်ပါအဆင့်တွေကို ဝက်ဘ်ဆိုက်ပိုင်ရှင်ကိုယ်တိုင် လုပ်ရပါမယ်။

## 1. Add the site to Google Search Console · Search Console မှာ ထည့်ပါ

1. Open <https://search.google.com/search-console> and choose **Add property → URL prefix**, then enter `https://yaykyawfair.vercel.app/`.
2. Pick the **HTML tag** method and copy only the code inside `content="..."`.
3. In Vercel go to **yaykyawfair → Settings → Environment Variables**, add `GOOGLE_SITE_VERIFICATION` with that code for **Production**, then redeploy (Deployments → ⋯ → Redeploy).
4. Back in Search Console, press **Verify**.

(Or pick the **HTML file** method, put the `googleXXXX.html` file in `public/`, push, and press Verify.)

၁။ Search Console မှာ URL prefix အနေနဲ့ `https://yaykyawfair.vercel.app/` ထည့်ပါ။ ၂။ **HTML tag** နည်းကိုရွေးပြီး `content="..."` ထဲက ကုဒ်ကို ကူးပါ။ ၃။ Vercel → Settings → Environment Variables မှာ `GOOGLE_SITE_VERIFICATION` အဖြစ် ထည့်ပြီး Redeploy လုပ်ပါ။ ၄။ Search Console မှာ **Verify** နှိပ်ပါ။

## 2. Submit the sitemap and request indexing · Sitemap တင်ပြီး Request Indexing လုပ်ပါ

1. In Search Console open **Sitemaps**, enter `sitemap.xml` and press **Submit**.
2. Open **URL Inspection**, paste `https://yaykyawfair.vercel.app/`, then press **Request Indexing**. Do the same for `https://yaykyawfair.vercel.app/about/`.

It usually takes a few days to a few weeks before the game shows in results. ရလဒ်ထဲ ပေါ်လာဖို့ ရက်အနည်းငယ်မှ အပတ်အနည်းငယ်အထိ ကြာတတ်ပါတယ်။

Optional: do the same at Bing Webmaster Tools (<https://www.bing.com/webmasters>, it can import from Search Console). Its HTML tag code goes in `BING_SITE_VERIFICATION`.

## 3. A custom domain (recommended) · ကိုယ်ပိုင် Domain (အကြံပြု)

A domain such as `yaykyawnights.com` is easier to remember and to rank than a `.vercel.app` address.

1. Buy a domain (for example from Vercel Domains, Namecheap or Cloudflare) and add it in **Vercel → Settings → Domains**. Make it the primary domain so `yaykyawfair.vercel.app` redirects to it.
2. Add `SITE_URL` = `https://your-domain.com` in Vercel Environment Variables and redeploy. The canonical links, share cards and sitemap then use the new address.
3. Add the new domain as another property in Search Console and repeat step 2.

## 4. Backlinks · အခြားဆိုက်တွေက လင့်ခ်ပေးခြင်း

Google finds and trusts sites that other sites link to. Good places to share the link:

- your Facebook page and Myanmar gaming or Yangon groups, TikTok and YouTube video descriptions
- game listing sites such as itch.io (free to post a web game page that links back) and Newgrounds
- the GitHub repository's **About → Website** field
- friends' blogs, Myanmar tech or culture sites, and any news or community posts about the game

Share `https://yaykyawfair.vercel.app/about/` when you want people to read about the game first, and the main link when you want them to play straight away. ဖေ့စ်ဘုတ်၊ TikTok၊ itch.io စတဲ့နေရာတွေမှာ လင့်ခ်ကို မျှဝေပါ။
