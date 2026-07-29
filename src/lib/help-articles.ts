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
  /**
   * Two or three plain words, scannable in a list and matching what people actually
   * type. BAM searched "bulk" and no title contained it — the descriptive titles read
   * well in a sentence but are useless when you are scanning twelve of them for the
   * one you need. The long title stays as the second line; this is what you find it by.
   */
  shortTitle: string;
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
    shortTitle: "Getting started",
    title: "Getting started with the Creator studio",
    summary:
      "A quick tour of the three creator surfaces: your courses, your destinations, and your media library, plus where to go when you get stuck.",
    audience: "creator",
    steps: [
      "Sign in with a creator account. The Creator link in the top navigation opens your course list. If you land on a page saying you do not have access, your account is still a learner account: open a support thread and ask for the creator role.",
      "My courses (the Creator link, at /creator/courses) lists everything a learner can enroll in. Each card shows the course status: Draft, In review, Published, or Unpublished. Use the New course button to start one.",
      "Destinations (the Destinations link, at /creator/destinations) lists the real places your tours are built on. Every course is anchored to a destination. Use New destination to add a place, or the search box to find one by name, city, or country.",
      "Open a destination to reach everything that lives on it: its scenes, its media library, the Connections page (paths between scenes, plus the tour map), the public tour link, the embed snippet generator, and the Edit details form.",
      "Media (the Media link, at /creator/media) is your media library. Every file you upload is stored in Cloudinary and can be used in any destination or course you build.",
      "When you get stuck: search this Help Center at /help (also linked as Help in the top navigation and in the footer), read the longer guides at /docs, or click the round Get help button in the corner of any page, which offers these articles first and a support thread second.",
    ],
    videoScript:
      "Hi, welcome to Wanderlearn. Let me show you around the Creator studio. It is three surfaces, and you can see all of them in the top navigation once you sign in with a creator account. If you click Creator and get a page saying you do not have access, your account is still a learner account. Just open a support thread and ask us for the creator role. First surface: My courses. That is the Creator link. A course is what a learner enrolls in, and each card here shows its status: Draft, In review, Published, or Unpublished. The New course button starts a new one. Second surface: Destinations. These are the real places your tours are built on, and every course is anchored to one. You can create a new destination or search by name, city, or country. And here is the important part: when you open a destination, everything lives on that page. Its scenes, its media library, the Connections page where you wire scenes together and build the tour map, the public tour link, the embed generator, and the Edit details form. Third surface: Media. This is your media library. Everything you upload is stored in Cloudinary, and any file here can be used in any tour or course you build. And when you get stuck, you have three doors: the Help Center, which is the Help link in the top navigation and also in the footer, the longer guides at slash docs, and the round Get help button in the corner of every page. That button gives you a choice: browse these articles, or open a support thread. That is the studio. Go build something.",
    youtubeId: null,
  },
  {
    slug: "upload-media",
    shortTitle: "Upload files",
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
      "After upload, give each file a short Display name, a Description, and Tags so you can find it later. As you type a tag, existing tags that match appear below the box — click one to reuse it instead of creating a near-duplicate spelling. For videos, attach a transcript file (.srt, .vtt, or .txt). Without one, deaf and hard-of-hearing visitors cannot use the video at all, and neither can anyone who cannot turn the sound on. It is also required before a course with that video can be published. See /docs/transcripts for what a transcript does for your visitors and for you.",
      "Mind the size limits: images and 360 photos up to 10 MB, all video up to 100 MB, audio up to 10 MB, transcripts up to 10 MB. For 360 photos, use equirectangular images with a 2 to 1 aspect ratio at 6K (6144 by 3072). Do not go to 8K: a 2 to 1 image at 8K is 33.5 megapixels and exceeds the 25 megapixel ceiling, so it is rejected however small the file is. For 360 video, trim and re-export at a lower bitrate before uploading, because a few minutes of 8K equirectangular runs well past 100 MB.",
    ],
    videoScript:
      "Let me show you how uploading media works, including 360 content straight off an Insta360 camera. I am on the Media page, in the Upload new files section. First thing: pick the Kind. Image, 360 photo, Audio, Video, 360 video, Drone video, or Transcript. The kind matters because it decides what files are accepted and how the viewer treats them later. Now I choose my files. I can pick up to five at a time. And here is the nice part for Insta360 users: if I pick a dot I-N-S-P file, the kind switches to 360 photo by itself, and a dot I-N-S-V file switches it to 360 video. The app rewraps those files automatically so Cloudinary accepts them. No conversion step on your end. Before I hit Upload, I check the rows. If one says Wrong kind, that file's extension does not match the kind I picked, so I either change the kind or remove the file. Now I click Upload. Each file goes straight from the browser to Cloudinary, with its own progress bar. I keep this tab open until every row says Ready. And Ready is the gate: only Ready files show up when you build scenes or pick media anywhere else in the app. Last thing, give each file a short name, a description, and some tags, and attach a transcript to any video. Two reasons. First, without a transcript, deaf and hard of hearing visitors cannot use that video at all, and neither can anyone who cannot turn their sound on right now. Second, you will need it before publishing anyway. There is a page at slash docs slash transcripts explaining what else a transcript does for you, including what it does for search. That is it. Upload once, use it everywhere.",
    youtubeId: null,
  },
  {
    slug: "organize-media-by-tour",
    shortTitle: "Organize media",
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
    shortTitle: "Hotspots",
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
    shortTitle: "Publish and embed",
    title: "Publish your tour and embed it on your website",
    summary:
      "Flip a destination to public, share the tour link, generate the iframe snippet for your own site, and deep-link straight to a specific scene.",
    audience: "partner",
    steps: [
      "Open your destination from /creator/destinations and find the Public tour link section. The status pill reads Private until you change it: private tours are invisible to visitors and cannot be embedded. To show a private tour to a client before launch, use the Private preview link below the toggle: Create preview link, copy it, send it. Anyone with the link can view; Replace link kills every copy already sent.",
      "Click Toggle to make the tour public. Anyone with the link can now view it, no sign-in needed. The same button flips it back to private any time.",
      "Copy the shareable link with the Copy link button. It opens the tour at its default start scene; pick that scene in the Default start scene section on the same page.",
      "To share a link that lands on one specific scene, open that scene's page in the creator studio and use its Copy link button: it appends ?scene= and the scene's ID to the tour URL.",
      "To put the tour on your own website, scroll to Embed this tour (it activates once the tour is public). Choose a Theme (light or dark), an Accent color, a Width (default 100%), and a Height (default 600), and check the live preview.",
      "Click Copy embed code and paste the iframe into your site: WordPress, Squarespace, Weebly, Webflow, plain HTML, or React all work. Platform-by-platform walkthroughs live at /docs/embed-tours.",
      "To make an embed start on a specific scene, add the scene parameter to the iframe src by hand: append &scene= followed by the scene ID (use ? instead of & if it is the first parameter). The scene ID is the long code in the scene page's URL.",
    ],
    videoScript:
      "Your tour is built. Let us publish it and put it on your website. I am on my destination page, at the Public tour link section. Right now the pill says Private, which means visitors cannot see it and it cannot be embedded. If I want a client to see it before launch anyway, there is a Private preview link right below: I create it, copy it, and send it. Anyone with that link can view the tour while it stays hidden from everyone else, and if the link leaks, Replace kills every copy at once. I click Toggle, and now it is Public. Anyone with the link can view it, no account needed, and the same button takes it private again whenever I want. I grab the link with Copy link. That link opens the tour at its default start scene, and I can choose which scene that is in the Default start scene section right here on the same page. If I want to send someone to one exact scene instead, I open that scene in the creator studio and copy the link there; it adds a scene parameter to the U R L for me. Now the embed. I scroll to Embed this tour, which comes alive once the tour is public. I pick a theme, light or dark, an accent color, a width, and a height, and I can see exactly what I will get in the live preview. Then Copy embed code, and I paste that iframe into my own site. WordPress, Squarespace, Weebly, Webflow, plain HTML, React, they all work, and there are step-by-step guides for each at slash docs slash embed dash tours. One power move: to make the embed start on a specific scene, add the scene parameter to the iframe source yourself, using the scene's ID from its page U R L. That is it. Published, shared, and embedded.",
    youtubeId: null,
  },
  {
    slug: "report-a-bug",
    shortTitle: "Report a bug",
    title: "Report a bug or ask for help",
    summary:
      "Open a support thread, pick the right category, link your screenshots and recordings, and use the confirm-or-dispute loop when we mark it resolved.",
    audience: "partner",
    steps: [
      "Sign in, then click the round Get help button in the corner of any page. It opens a short menu with three choices: browse the help articles, see your existing support threads, or open a new one. Pick Open a support thread to reach the new-thread form. You can also go to /support and click New thread. Support threads require an account: there are no anonymous tickets.",
      "Write a one-line Subject that summarizes the problem.",
      "Pick a Category: Something's broken, Confusing UI, Feature request, Question, Course content, or Other. Bugs go under Something's broken.",
      "In Describe the issue, include the URL, what you clicked, what happened, and what you expected. The more specific, the faster the fix.",
      "Screenshots and screen recordings cannot be uploaded into the thread yet, so host them where you can link them (creators can upload a screenshot or screen recording to their own media library) and paste the link into the description or a reply.",
      "Click Open thread. Follow the conversation at /support: the Wanderlearn team replies both in-app and by email, and you can reply in the thread at any time.",
      "When the team believes it is fixed, you get an email saying the report was marked resolved, with a link back to the thread. Open it and answer the question Did this fix your issue?",
      "Click Yes, resolved if the fix worked: the thread then closes automatically 14 days after your confirmation. The Get help button also shows a badge counting replies you have not read yet — see the article on following a support conversation. Click Still broken if it did not: the thread reopens immediately, its priority is bumped, and the team is alerted right away. Use the What's still happening? box to say what you are still seeing.",
    ],
    videoScript:
      "Something broke, or something is confusing? Here is how to reach us, and what happens after. First, sign in, then click the round Get help button in the corner of any page. It opens a short menu with three choices: browse the help articles, see threads you have already opened, or start a new one. If your question is a how-do-I, try the articles first, they are faster than waiting on me. Otherwise pick Open a support thread, and you land on the new thread form. You can also get there from slash support with the New thread button. Quick note: threads are tied to your account, so there are no anonymous tickets. The form is three fields. A one-line subject. A category: Something's broken, Confusing U I, Feature request, Question, Course content, or Other. And the description. This is where you help us most: the U R L, what you clicked, what happened, and what you expected. One thing to know: you cannot upload files into a thread yet. So put your screenshot or screen recording somewhere linkable, creators can just use their own media library for that, and paste the link into the description. Then click Open thread. From there, watch slash support. We reply in-app and by email, and you can keep replying in the thread. Now the part people miss. When we think it is fixed, you get an email saying the report was marked resolved, with a link back to your thread. Open it, and answer one question: did this fix your issue? If yes, click Yes, resolved, and the thread closes itself fourteen days after your confirmation. If no, click Still broken. That reopens the thread on the spot, bumps its priority, and pings us immediately. Tell us what you are still seeing, and we dig back in.",
    youtubeId: null,
  },
  {
    slug: "update-tour-details",
    shortTitle: "Rename a tour",
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
  {
    slug: "create-scenes-in-bulk",
    shortTitle: "Bulk create scenes",
    title: "Create a whole tour's scenes at once",
    summary:
      "Turn every 360 file you have assigned to a tour into scenes in one step, instead of filling in the new-scene form once per room.",
    audience: "creator",
    steps: [
      "First make sure the 360 files you want are assigned to this tour. Open the destination from /creator/destinations, scroll to Destination media library, and use Add media to assign anything missing. Only files assigned to this tour appear in the bulk creator.",
      "On the same destination page, find the section called Create scenes from this tour's media and click Choose files.",
      "You see every 360 photo and 360 video assigned to this tour that does not already have a scene. Files that already back a scene are hidden on purpose, so you cannot accidentally create the same room twice.",
      "Tick the files you want, or click Select all. The counter shows how many are selected.",
      "Click Create scenes. You get one scene per file, named after the file's display name, or its original filename if you never gave it one.",
      "Read the confirmation. It tells you how many scenes were created, and how many were skipped because they were not ready yet. Skipped files stay available: upload finishes, come back, run it again.",
      "Now open each scene to do the parts only you can do: set the start view, place hotspots, and link scenes together. Bulk creation makes the rooms; you still shape the tour.",
      "If the section says every file already has a scene, that is the expected end state. Assign more media to this tour to add more scenes.",
    ],
    videoScript:
      "If you have just come back from a shoot with twenty 360 photos, you do not want to fill in the new scene form twenty times. Here is the fast way. First, the files have to be assigned to this tour. I open my destination, scroll to the Destination media library, and use Add media for anything missing. That matters, because the bulk creator only offers files assigned to this tour. Now, on the same page, I find Create scenes from this tour's media, and click Choose files. Look at what it shows me: every 360 photo and 360 video assigned to this tour that does not already have a scene. Files that already have one are hidden, deliberately, so I cannot create the same room twice by accident. I tick the ones I want, or hit Select all, and the counter tells me how many I have. Then Create scenes. One scene per file, each one named after the file's display name, or its original filename if I never renamed it. The confirmation tells me how many were created and how many were skipped for not being ready yet. Skipped ones are not lost; when the upload finishes, come back and run it again. And then the part that is still yours: open each scene and set the start view, place the hotspots, link the rooms together. The bulk tool makes the rooms. You still build the tour.",
    youtubeId: null,
  },
  {
    slug: "set-arrival-view",
    shortTitle: "Arrival view",
    title: "Make visitors face the right way when they walk in",
    summary:
      "Choose which direction the camera points when someone arrives from a particular scene, so moving through your tour feels like walking rather than teleporting.",
    audience: "creator",
    steps: [
      "Understand the problem first: a scene has one start view, and without this setting everyone arriving faces that same direction no matter which door they came through. Walk a corridor backwards and the view spins to face the way you were originally pointed, which breaks the feeling of moving through a real place.",
      "Open the scene visitors arrive AT, not the one they leave from: /creator/destinations, click the destination, click the scene's name, then Edit scene.",
      "Scroll to How visitors arrive here. It lists every scene that links into this one. If the list is empty, nothing links here yet, so there is nothing to set.",
      "Drag the 360 viewer at the top of the page until you are facing the direction someone should be looking when they arrive from a particular scene.",
      "Click Capture current view on the row for that scene. The row now shows the saved yaw and pitch.",
      "Repeat per route. A gallery reached from the lobby and from the courtyard should usually face two different ways, and that is the whole point of doing this per link.",
      "Click Clear on any row to go back to the scene's own start view, which is the behavior you had before.",
      "Walk your tour both directions to check it. This is a feel change, so it is judged by walking it, not by looking at numbers.",
    ],
    videoScript:
      "This is the setting that makes a tour feel like walking instead of teleporting. Here is the problem it solves. Every scene has one start view. Without this setting, everyone who arrives faces that same direction, no matter which door they came through. So if you walk down a corridor and then turn around and walk back, the view spins to face the original direction, and the illusion collapses. The fix is to set the arrival direction per route. Now, important: you do this on the scene people arrive AT, not the one they leave from. That is because this is the only page whose viewer shows the room they actually land in, so you can see what facing that way looks like. So I open the destination, click the scene, click Edit scene, and scroll to How visitors arrive here. This lists every scene that links into this one. I drag the viewer at the top until I am facing the way somebody walking in from the lobby should be facing. Then on the lobby row, I click Capture current view. Saved. Now I do the courtyard row, and I point it a different way, because someone coming from the courtyard is walking in through a different door. That is the whole point of setting it per route. If you want to undo one, Clear puts that route back to the scene's own start view. And then go walk your tour, both directions. This is a feel change. You judge it by walking it.",
    youtubeId: null,
  },
  {
    slug: "format-descriptions",
    shortTitle: "Format descriptions",
    title: "Add formatting to a tour or course description",
    summary:
      "Use bold, italics, links, and bullet lists in destination and course descriptions to give them some personality.",
    audience: "creator",
    steps: [
      "Open the Edit details form for a destination (/creator/destinations, then Edit details) or the edit form for a course.",
      "Type formatting directly in the Description box. Surround text with two asterisks for **bold** and one asterisk for *italic*.",
      "Make a link by writing the text in square brackets followed by the address in parentheses, like this: [our website](https://example.com). Include the https:// part.",
      "Make a bullet list by starting each line with a dash and a space. Leave a blank line before the list starts.",
      "Save. The formatting appears on the tour or course detail page.",
      "Headings and images are deliberately not supported. Descriptions sit on pages that already have their own headings, and a heading inside one would compete with the page title and confuse screen readers.",
      "Catalog cards and search-engine previews strip the formatting back to plain text automatically, so your lists and bold text never leak into a Google result as raw symbols.",
      "Links you add always open in a new tab and carry the safety attributes browsers expect, since tours are embedded on partner websites.",
    ],
    videoScript:
      "Your tour descriptions do not have to be one flat paragraph. Here is the formatting you can use. I am in the Edit details form for a destination, in the Description box. For bold, I put two asterisks on each side of the words. For italic, one asterisk each side. For a link, square brackets around the text I want people to click, then the web address in parentheses right after, and I include the H T T P S part. For a bullet list, I start each line with a dash and a space, and I leave a blank line before the list begins. Then I save, and the formatting shows up on the tour page. Two things to know. First, headings and images are deliberately not supported. That is not an oversight. The description sits on a page that already has its own title, and a heading inside the description would compete with it and confuse screen readers. Second, the cards in the catalog and the previews that show up in search results strip all of this back to plain text automatically, so you never get raw asterisks showing up in a Google result. Keep it light. A bold phrase, a link, maybe a short list. That is usually all a description needs.",
    youtubeId: null,
  },
  {
    slug: "reset-your-password",
    shortTitle: "Reset password",
    title: "Reset a forgotten password",
    summary:
      "Get back into your account when you cannot remember your password, and what to do if the reset email does not arrive.",
    audience: "learner",
    steps: [
      "Go to the sign-in page at /sign-in and click Forgot your password? next to the Password field.",
      "Enter the email address on your account and click Send the reset link.",
      "The confirmation is deliberately the same whether or not that address has an account. That is on purpose: it stops strangers using the form to find out who has an account here.",
      "Open the email and click the link. It expires in one hour and works only once.",
      "Choose a new password of at least 10 characters, type it a second time to confirm, and save.",
      "Sign in with the new password.",
      "If the link says it is invalid, already used, or expired, click Request a new reset link on that page and start again. An expired link cannot be revived.",
      "If the email never arrives, check your spam folder first. Failing that, use Email me a sign-in link on the sign-in page: it signs you in without a password, and you can then change your password from your account page.",
    ],
    videoScript:
      "Forgot your password? Here is how to get back in. On the sign-in page, next to the Password field, there is a link that says Forgot your password. I click that, type the email address on my account, and click Send the reset link. Now, one thing you will notice: the confirmation message is the same whether or not that address actually has an account. That is deliberate. If it said no account found, anyone could use this form to work out who has an account here, so we do not do that. I open my email and click the link. Two things about that link: it expires in one hour, and it works only once. Then I choose a new password, at least ten characters, type it again to confirm, and save. Now I can sign in with it. If you get a page saying the link is invalid, already used, or expired, that is normal if it has been sitting in your inbox a while. Click Request a new reset link and start again. There is no way to revive an expired link. And if the email never shows up at all, check spam first, then use the Email me a sign-in link button on the sign-in page instead. That signs you in without a password, and once you are in you can set a new one from your account page.",
    youtubeId: null,
  },
  {
    slug: "follow-your-support-thread",
    shortTitle: "Your support threads",
    title: "Follow a support conversation you have already opened",
    summary:
      "Find your existing threads, see when the team has replied, and close the loop by confirming or disputing a fix.",
    audience: "partner",
    steps: [
      "Click the round Get help button in the corner of any page while signed in.",
      "Choose My support threads. That opens /support, the list of every conversation you have opened, newest activity first.",
      "Watch the Get help button for a number badge. It counts replies from the team that you have not read yet, across all your threads.",
      "Open a thread to read the reply. Opening it clears that thread's contribution to the badge automatically, so the count reflects what you actually have left to read.",
      "Reply in the thread at any time. The team is notified both in-app and by email.",
      "When we think we have fixed something, you get an email and the thread asks: Did this fix your issue?",
      "Click Yes, resolved if it worked. The thread closes itself 14 days later. Click Still broken if it did not: the thread reopens immediately, its priority is raised, and we are alerted straight away.",
      "Use the What's still happening? box when disputing. What you saw, and what you expected, is what makes the second attempt faster than the first.",
    ],
    videoScript:
      "You opened a support thread. Here is how to follow it, and how to tell when we have answered. While you are signed in, click the round Get help button in the corner of any page. There are three choices there now, and the one you want is My support threads. That opens your list, newest activity first. Now the part that saves you checking: look at the Get help button itself. When we reply, it grows a little number badge. That is how many replies you have not read yet, across all your threads. Open a thread and that thread's replies stop counting, so the number always reflects what is actually left to read. Inside a thread you can reply any time, and we get notified in the app and by email. And then the part people miss. When we think something is fixed, you get an email, and the thread asks you one question: did this fix your issue? If it did, click Yes resolved, and the thread closes itself two weeks later. If it did not, click Still broken. That reopens it on the spot, raises its priority, and alerts us immediately. When you do that, use the What is still happening box, and tell us what you saw and what you expected. That is the difference between us guessing and us fixing it.",
    youtubeId: null,
  },
  {
    slug: "connect-scenes",
    shortTitle: "Connect scenes",
    title: "Connect scenes from one list",
    summary:
      "See every path between your scenes on one page, add connections with an automatic return trip, and find rooms that nothing leads to.",
    audience: "creator",
    steps: [
      "Open your destination from /creator/destinations and click Connections, next to New scene.",
      "Read the summary line first: scenes, connections, orphans (nothing leads there), dead ends (no way out), and unreachable (cannot be walked to from the start scene). Those badges also appear on each scene's card.",
      "To connect two scenes, find the card for the scene the visitor walks FROM, pick the target under Connect to, and leave 'Also create the return connection' ticked unless you want a one-way path. Click Add.",
      "New connections start without an arrow placed in the 360 view, so visitors cannot see them yet. Each one shows a 'Needs placement' chip.",
      "Click 'Place the arrow' on that chip. It opens the scene editor already in click-to-place mode: click the spot in the panorama where the arrow belongs, and you are done.",
      "A Duplicate chip means the same connection exists twice. Two doors between the same rooms is legitimate; an accidental double can be deleted right there.",
      "Delete removes a connection immediately. The return connection is separate, so deleting one direction keeps the other.",
      "Come back after any big edit: the orphan, dead-end, and unreachable badges recompute every time, which makes this page the quickest health check your tour has.",
    ],
    videoScript:
      "Building the paths between scenes used to mean opening every scene one at a time. Now there is one page for it. From my destination I click Connections, right next to New scene. Top of the page, the summary line: how many scenes, how many connections, and three numbers worth watching. Orphans, which nothing leads to. Dead ends, which have no way out. And unreachable, which cannot be walked to from the start of the tour at all. The same badges show on each scene's card below. To connect two scenes, I go to the card for the scene the visitor walks from, pick the target under Connect to, and leave the return connection box ticked, because most doors work in both directions. Add. Now, one important thing. A connection made here has no arrow placed in the 360 view yet, so visitors cannot see it. That is what the Needs placement chip means. I click Place the arrow, and it drops me into the scene editor already in placing mode. One click on the right spot in the panorama, and the arrow is live. If you see a Duplicate chip, the same connection exists twice. Sometimes that is real, two doors between the same rooms. If it is an accident, delete one right there. And that is the habit to build: after any big change, come back here and glance at the badges. If nothing is orphaned, nothing is a dead end, and everything is reachable, your tour walks clean.",
    youtubeId: null,
  },
  {
    slug: "tour-map",
    shortTitle: "Tour map",
    title: "Give visitors a you-are-here map",
    summary:
      "Add a mini-map to your tour so visitors always know where they are: use a floor plan you upload, or a built-in background with automatic layout.",
    audience: "creator",
    steps: [
      "Open your destination from /creator/destinations, click Connections, and scroll to the Tour map section.",
      "Pick a map background. The best map is a real floor plan: any image works — a scan, an illustration, an exported drawing. Upload it right there in the Upload a floor plan box (it goes into your media library as a normal image), then select it.",
      "No floor plan? Pick Simple grid or Blank canvas. The numbered scene pins themselves become the map.",
      "If an older image refuses with a message about missing dimensions, re-upload it once and pick the new copy. Images uploaded before mid-2026 predate stored dimensions, which the map needs to position pins.",
      "Click Arrange scenes automatically to lay every scene out based on your connections, starting from your start scene. It is a starting arrangement, not a final one.",
      "Fine-tune each pin: click Place by clicking on a scene row, then click the exact spot on the map. Or type exact x and y percent values in the fields and Save — the keyboard route does everything the mouse route does.",
      "Remove takes a scene off the map. Scenes not on the map simply do not appear in the visitor mini-map; the tour itself is unaffected.",
      "View your public tour: the mini-map sits in the corner of the viewer. It follows visitors as they move, and tapping a pin jumps to that scene. Scenes are only shown once placed, so you can build the map gradually.",
    ],
    videoScript:
      "Let us give your visitors a you-are-here map. Open your destination, click Connections, and scroll down to Tour map. First decision: the background. The best map is a real floor plan, and any image works — a scan of the building plan, an illustration, something you drew in any drawing app. There is an upload box right here, so you do not have to leave the page: upload, then select it. No floor plan? No problem. Pick the built-in grid or the blank canvas, because the numbered pins are about to become the map themselves. One note: if an older image refuses with a message about missing dimensions, re-upload it once. Older uploads predate the size information the map needs. Now the fun part. Click Arrange scenes automatically, and every scene lands on the map laid out by how your rooms connect, starting from your start scene. Treat it as a draft. To fine-tune, click Place by clicking on a scene row, then click the exact spot on the map where that room lives. Prefer the keyboard? The x and y percent fields do exactly the same job. Remove takes a scene off the map without touching the tour. And here is what visitors get: a small round map in the corner of the tour that follows them as they move, where tapping any pin jumps straight to that room. Scenes only appear once you have placed them, so you can build the map gradually and publish when it feels right.",
    youtubeId: null,
  },
];

export function helpArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

/** Lowercased search haystack: short title + title + summary + steps. */
export function helpSearchText(article: HelpArticle): string {
  return `${article.shortTitle} ${article.title} ${article.summary} ${article.steps.join(" ")}`.toLowerCase();
}
