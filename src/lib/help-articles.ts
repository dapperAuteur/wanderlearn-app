// In-app Help Center content, rendered at /[lang]/help. Plain data: the index page searches it,
// the article page renders steps as an ordered list plus a video walkthrough section.
//
// House rules for this file:
// - Every claim must match ACTUAL current app behavior. When the app changes, update the article
//   and its videoScript in the same branch (docs-sync rule).
// - videoScript is the word-for-word narration BAM reads while screen-recording. Keep each one
//   conversational and 60-120 seconds read aloud, and keep it in lockstep with the steps.
// - youtubeId stays null until BAM records and uploads the walkthrough, then pastes the ID here
//   (see plans/user-tasks/42-record-help-center-videos.md).
// - Article bodies are English-only by design; UI chrome strings live in the dictionaries.

export type HelpAudience = "creator" | "partner" | "learner";

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  audience: HelpAudience;
  /** Ordered, plain-text steps. Rendered as an <ol>. */
  steps: string[];
  /** Word-for-word narration for the recorded walkthrough. Matches the steps exactly. */
  videoScript: string;
  /** YouTube video ID once the walkthrough is recorded; null renders a "coming soon" box. */
  youtubeId: string | null;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started-creator-studio",
    title: "Getting started with the Creator studio",
    summary:
      "A quick tour of the three creator surfaces: your courses, your destinations, and your media library, plus where to go when you get stuck.",
    audience: "creator",
    steps: [
      "Sign in with a creator account. The Creator link in the top navigation opens your course list. If you land on a page saying you do not have access, your account is still a learner account: open a support thread and ask for the creator role.",
      "My courses (the Creator link, at /creator/courses) lists everything a learner can enroll in. Each card shows the course status: Draft, In review, Published, or Unpublished. Use the New course button to start one.",
      "Destinations (the Destinations link, at /creator/destinations) lists the real places your tours are built on. Every course is anchored to a destination. Use New destination to add a place, or the search box to find one by name, city, or country.",
      "Open a destination to reach everything that lives on it: its scenes, its media library, the public tour link, the embed snippet generator, and the Edit details form.",
      "Media (the Media link, at /creator/media) is your media library. Every file you upload is stored in Cloudinary and can be used in any destination or course you build.",
      "When you get stuck: search this Help Center at /help (also linked as Help in the top navigation and in the footer), read the longer guides at /docs, or click the round Get help button in the corner of any page, which offers these articles first and a support thread second.",
    ],
    videoScript:
      "Hi, welcome to Wanderlearn. Let me show you around the Creator studio. It is three surfaces, and you can see all of them in the top navigation once you sign in with a creator account. If you click Creator and get a page saying you do not have access, your account is still a learner account. Just open a support thread and ask us for the creator role. First surface: My courses. That is the Creator link. A course is what a learner enrolls in, and each card here shows its status: Draft, In review, Published, or Unpublished. The New course button starts a new one. Second surface: Destinations. These are the real places your tours are built on, and every course is anchored to one. You can create a new destination or search by name, city, or country. And here is the important part: when you open a destination, everything lives on that page. Its scenes, its media library, the public tour link, the embed generator, and the Edit details form. Third surface: Media. This is your media library. Everything you upload is stored in Cloudinary, and any file here can be used in any tour or course you build. And when you get stuck, you have three doors: the Help Center, which is the Help link in the top navigation and also in the footer, the longer guides at slash docs, and the round Get help button in the corner of every page. That button gives you a choice: browse these articles, or open a support thread. That is the studio. Go build something.",
    youtubeId: null,
  },
  {
    slug: "upload-media",
    title: "Upload media, including 360 photos and video",
    summary:
      "How the media uploader works: picking the right kind, Insta360 .insp and .insv support, batch limits, and why files must reach Ready before you can use them.",
    audience: "creator",
    steps: [
      "Go to Media in the top navigation (/creator/media) and find the Upload new files section.",
      "Pick a Kind first: Image, 360 photo, Audio, Video, 360 video, Drone video, or Transcript. The kind decides which files are accepted and how the viewer treats them later.",
      "Choose your files. You can upload up to 5 files at a time. Insta360 files are supported directly: picking a .insp file switches the kind to 360 photo and a .insv file switches it to 360 video, and the app rewraps them automatically so Cloudinary accepts them.",
      "Check the queued rows before uploading. A row marked Wrong kind means that file's extension does not match the selected kind: change the Kind or remove the file.",
      "Click Upload. Files go straight from your browser to Cloudinary with a progress bar per file. Keep the tab open until every row reads Ready.",
      "Ready is the gate: only files with the Ready status show up in the scene panorama picker and the other media pickers. A file still uploading cannot be placed anywhere.",
      "After upload, give each file a short Display name, a Description, and Tags so you can find it later. For videos, attach a transcript file (.srt, .vtt, or .txt): it is required before a course with that video can be published.",
      "Mind the size limits: images up to 50 MB, 360 photos up to 100 MB, standard video up to 2 GB, 360 and drone video up to 5 GB, audio up to 500 MB, transcripts up to 5 MB. For 360 photos, use equirectangular images with a 2 to 1 aspect ratio, 4K or better.",
    ],
    videoScript:
      "Let me show you how uploading media works, including 360 content straight off an Insta360 camera. I am on the Media page, in the Upload new files section. First thing: pick the Kind. Image, 360 photo, Audio, Video, 360 video, Drone video, or Transcript. The kind matters because it decides what files are accepted and how the viewer treats them later. Now I choose my files. I can pick up to five at a time. And here is the nice part for Insta360 users: if I pick a dot I-N-S-P file, the kind switches to 360 photo by itself, and a dot I-N-S-V file switches it to 360 video. The app rewraps those files automatically so Cloudinary accepts them. No conversion step on your end. Before I hit Upload, I check the rows. If one says Wrong kind, that file's extension does not match the kind I picked, so I either change the kind or remove the file. Now I click Upload. Each file goes straight from the browser to Cloudinary, with its own progress bar. I keep this tab open until every row says Ready. And Ready is the gate: only Ready files show up when you build scenes or pick media anywhere else in the app. Last thing, give each file a short name, a description, and some tags, and attach a transcript to any video, because you will need that transcript before publishing. That is it. Upload once, use it everywhere.",
    youtubeId: null,
  },
  {
    slug: "organize-media-by-tour",
    title: "Organize media by tour",
    summary:
      "Keep each tour's media in its own library: assign files on the destination page, filter and bulk-assign from the media page, and auto-add everything your scenes already use.",
    audience: "creator",
    steps: [
      "Every destination has its own media library. Open a destination from /creator/destinations and scroll to the Destination media library section: Assigned media is what you have placed there on purpose, and Auto-included from your scenes lists media already wired into scenes at that destination.",
      "To assign from the destination page, click Add media, then click Assign next to any file from your library. Note: you need at least one of your own scenes at that destination before you can assign media there. Click Unassign to take a file back out.",
      "For bulk work, go to the Media page (/creator/media) and use the tour filter chips at the top: All media, one chip per tour, and Not in any tour. The Not in any tour chip is the fastest way to find strays.",
      "To add several files to a tour at once, tick the checkbox on each file, pick the tour from the tour dropdown, and click Add to tour.",
      "To catch up a whole account in one click, use the Auto-add scene media to tours button. It walks every scene you own and puts each panorama and poster already used in a scene into that scene's tour library.",
      "Re-check the destination page afterwards: the Assigned media list is what courses and tours anchored to that destination will find in one place.",
    ],
    videoScript:
      "As soon as you have more than one tour, you want each tour's media in its own library. Here is how. First, the destination page. Every destination has a Destination media library section with two lists: Assigned media, which is what you placed there on purpose, and Auto-included from your scenes, which is media already wired into scenes at that place. To assign something here, I click Add media and then Assign next to a file. One rule: you need at least one of your own scenes at the destination before you can assign media to it. And Unassign takes a file back out. Now the bulk tools, over on the Media page. At the top I have tour filter chips: All media, a chip for each of my tours, and Not in any tour. That last chip is my favorite, because it instantly shows me the strays. To move several files at once, I tick their checkboxes, pick a tour from the dropdown, and click Add to tour. Done. And if you have been building tours for a while and nothing is organized yet, there is a one-click catch-up: the Auto-add scene media to tours button. It walks every scene you own and drops each panorama and poster that a scene already uses into that scene's tour library. Then I go back to the destination page and check the Assigned media list, because that is exactly what courses and tours anchored to this place will find. Tidy library, faster building.",
    youtubeId: null,
  },
  {
    slug: "edit-scene-hotspots",
    title: "Edit hotspots on a scene",
    summary:
      "Place clickable markers inside a 360 scene: informational content, external links, or links to another tour, with the click-to-place editor.",
    audience: "creator",
    steps: [
      "Open your destination from /creator/destinations, click the scene's name in the Scenes section, then click Edit scene. Scroll to the section called Hotspots and scene links.",
      "In the Hotspots subsection, click Add hotspot. The 360 viewer above highlights and shows the message: Click anywhere inside the 360 view to place the point.",
      "Click the exact spot in the panorama where the marker should sit. The form below captures the position for you: there is no drag and no manual coordinate entry for hotspots.",
      "Give the hotspot a Title (required), then choose what it does: Show content, Open external URL, or Link to another tour.",
      "For Show content, write the text learners see in the Content box (plain text or small HTML). You can also add an external link; include the https:// part. For Link to another tour, pick a Target tour from the dropdown: only tours that have opted in to external linking appear there.",
      "Click Save hotspot. The marker appears immediately in the live viewer at the top of the page, which is the same viewer learners use.",
      "To change a hotspot's wording or type, click Edit next to it in the list. To move one, delete it and place a new one at the right spot: there is no reposition control yet. Careful with Delete: it removes the hotspot immediately, with no confirmation prompt.",
    ],
    videoScript:
      "Hotspots are the clickable markers inside a 360 scene, and here is how you edit them. From my destination I click the scene's name, then Edit scene, and I scroll down to Hotspots and scene links. Now watch the order, because it matters: I click Add hotspot first. The viewer up top lights up and tells me to click anywhere inside the 360 view to place the point. So I find my spot in the panorama, and click. That is it for placement. There is no dragging and no typing in coordinates; the click is the position. Now the form. Every hotspot needs a Title. Then I choose what it does. Show content, for a marker that opens some text. Open external U R L, for a marker that sends people to another website; remember to include the H T T P S part. Or Link to another tour, which shows a preview card and walks the visitor into a different tour. For that one I pick a Target tour, and only tours that have opted in to linking show up in the list. I click Save hotspot, and look at the viewer up top: the marker is already there, in the exact same viewer learners use. To reword one later, click Edit next to it. To move one, delete it and place a fresh one, because there is no reposition control yet. And one warning: Delete is immediate. No confirmation. So delete with intent.",
    youtubeId: null,
  },
  {
    slug: "publish-and-embed-your-tour",
    title: "Publish your tour and embed it on your website",
    summary:
      "Flip a destination to public, share the tour link, generate the iframe snippet for your own site, and deep-link straight to a specific scene.",
    audience: "partner",
    steps: [
      "Open your destination from /creator/destinations and find the Public tour link section. The status pill reads Private until you change it: private tours are invisible to visitors and cannot be embedded.",
      "Click Toggle to make the tour public. Anyone with the link can now view it, no sign-in needed. The same button flips it back to private any time.",
      "Copy the shareable link with the Copy link button. It opens the tour at its default start scene; pick that scene in the Default start scene section on the same page.",
      "To share a link that lands on one specific scene, open that scene's page in the creator studio and use its Copy link button: it appends ?scene= and the scene's ID to the tour URL.",
      "To put the tour on your own website, scroll to Embed this tour (it activates once the tour is public). Choose a Theme (light or dark), an Accent color, a Width (default 100%), and a Height (default 600), and check the live preview.",
      "Click Copy embed code and paste the iframe into your site: WordPress, Squarespace, Weebly, Webflow, plain HTML, or React all work. Platform-by-platform walkthroughs live at /docs/embed-tours.",
      "To make an embed start on a specific scene, add the scene parameter to the iframe src by hand: append &scene= followed by the scene ID (use ? instead of & if it is the first parameter). The scene ID is the long code in the scene page's URL.",
    ],
    videoScript:
      "Your tour is built. Let us publish it and put it on your website. I am on my destination page, at the Public tour link section. Right now the pill says Private, which means visitors cannot see it and it cannot be embedded. I click Toggle, and now it is Public. Anyone with the link can view it, no account needed, and the same button takes it private again whenever I want. I grab the link with Copy link. That link opens the tour at its default start scene, and I can choose which scene that is in the Default start scene section right here on the same page. If I want to send someone to one exact scene instead, I open that scene in the creator studio and copy the link there; it adds a scene parameter to the U R L for me. Now the embed. I scroll to Embed this tour, which comes alive once the tour is public. I pick a theme, light or dark, an accent color, a width, and a height, and I can see exactly what I will get in the live preview. Then Copy embed code, and I paste that iframe into my own site. WordPress, Squarespace, Weebly, Webflow, plain HTML, React, they all work, and there are step-by-step guides for each at slash docs slash embed dash tours. One power move: to make the embed start on a specific scene, add the scene parameter to the iframe source yourself, using the scene's ID from its page U R L. That is it. Published, shared, and embedded.",
    youtubeId: null,
  },
  {
    slug: "report-a-bug",
    title: "Report a bug or ask for help",
    summary:
      "Open a support thread, pick the right category, link your screenshots and recordings, and use the confirm-or-dispute loop when we mark it resolved.",
    audience: "partner",
    steps: [
      "Sign in, then click the round Get help button in the corner of any page. It opens a short menu with two choices: browse the help articles, or open a support thread. Pick Open a support thread to reach the new-thread form. You can also go to /support and click New thread. Support threads require an account: there are no anonymous tickets.",
      "Write a one-line Subject that summarizes the problem.",
      "Pick a Category: Something's broken, Confusing UI, Feature request, Question, Course content, or Other. Bugs go under Something's broken.",
      "In Describe the issue, include the URL, what you clicked, what happened, and what you expected. The more specific, the faster the fix.",
      "Screenshots and screen recordings cannot be uploaded into the thread yet, so host them where you can link them (creators can upload a screenshot or screen recording to their own media library) and paste the link into the description or a reply.",
      "Click Open thread. Follow the conversation at /support: the Wanderlearn team replies both in-app and by email, and you can reply in the thread at any time.",
      "When the team believes it is fixed, you get an email saying the report was marked resolved, with a link back to the thread. Open it and answer the question Did this fix your issue?",
      "Click Yes, resolved if the fix worked: the thread then closes automatically 14 days after your confirmation. Click Still broken if it did not: the thread reopens immediately, its priority is bumped, and the team is alerted right away. Use the What's still happening? box to say what you are still seeing.",
    ],
    videoScript:
      "Something broke, or something is confusing? Here is how to reach us, and what happens after. First, sign in, then click the round Get help button in the corner of any page. It opens a short menu with two choices: browse the help articles, or open a support thread. If your question is a how-do-I, try the articles first, they are faster than waiting on me. Otherwise pick Open a support thread, and you land on the new thread form. You can also get there from slash support with the New thread button. Quick note: threads are tied to your account, so there are no anonymous tickets. The form is three fields. A one-line subject. A category: Something's broken, Confusing U I, Feature request, Question, Course content, or Other. And the description. This is where you help us most: the U R L, what you clicked, what happened, and what you expected. One thing to know: you cannot upload files into a thread yet. So put your screenshot or screen recording somewhere linkable, creators can just use their own media library for that, and paste the link into the description. Then click Open thread. From there, watch slash support. We reply in-app and by email, and you can keep replying in the thread. Now the part people miss. When we think it is fixed, you get an email saying the report was marked resolved, with a link back to your thread. Open it, and answer one question: did this fix your issue? If yes, click Yes, resolved, and the thread closes itself fourteen days after your confirmation. If no, click Still broken. That reopens the thread on the spot, bumps its priority, and pings us immediately. Tell us what you are still seeing, and we dig back in.",
    youtubeId: null,
  },
  {
    slug: "update-tour-details",
    title: "Update a tour's name and description",
    summary:
      "Edit a destination's name, description, location, links, and styling from the Edit details form, and know which field changes the public URL.",
    audience: "creator",
    steps: [
      "Open your destination from /creator/destinations and click Edit details.",
      "Change the Name (required) and the Description (up to 2000 characters). The description shows on the destination's public pages.",
      "Leave the Slug field alone unless you must change it. The slug is the tour's public web address, so changing it breaks links and embeds you have already shared. Leave it blank to generate one from the name.",
      "Fill in the location fields if you have them: Country, City, and Latitude and Longitude in decimal degrees. The coordinates place your tour's pin on the discovery globe.",
      "Optionally add a Website link and a YouTube video link. The YouTube link turns the public page into a video tour.",
      "Under Tour styling, pick a Tour type (it sets the pin color on the globe) and, if you like, custom colors for the scene-link arrows and hotspot pins.",
      "Click Save destination. You return to the destination page with a Changes saved confirmation, and the public tour page updates right away.",
    ],
    videoScript:
      "Renaming a tour or rewriting its description takes about a minute. Here is the whole flow. From Destinations, I open my tour and click Edit details. Top of the form: Name and Description. The name is required, and the description, up to two thousand characters, is what shows on the tour's public pages. Now a word of caution about the field right under the name: the Slug. That is the tour's public web address. If you change it, every link and every embed you have already shared stops working. So leave it alone unless you really mean it, and if you leave it blank, the app generates one from the name. Next, location. Country, city, and latitude and longitude in decimal degrees. Those coordinates are what place your tour's pin on the discovery globe, so they are worth filling in. You can also add a website link, and a YouTube link if you want the public page to play a video tour. Then styling: pick a tour type, which sets your pin color on the globe, and choose custom colors for the scene-link arrows and hotspot pins if the defaults do not match your space. Finally, Save destination. I land back on the destination page with a Changes saved banner, and the public tour page reflects the new details right away. Quick, safe, done.",
    youtubeId: null,
  },
];

export function helpArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

/** Lowercased search haystack: title + summary + steps. */
export function helpSearchText(article: HelpArticle): string {
  return `${article.title} ${article.summary} ${article.steps.join(" ")}`.toLowerCase();
}
