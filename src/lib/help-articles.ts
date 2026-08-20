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
      "Hunts (the Hunts button on a destination, between Connections and New scene) turns that tour into something a visitor plays: an ordered set of stops, each one able to stay shut until the visitor answers a question, holds a key they found hidden elsewhere, or physically arrives at the place. Each hunt carries two badges so you can see at a glance what it is: Draft or Published, and Playable anywhere or On site, the second worked out from the stops themselves rather than set by hand.",
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
      "Go to Media in the top navigation (/creator/media) and find the Upload new files section. You do not have to start here: there is an Upload new 360 file panel on the New scene page, and an Upload new files to this tour panel in the Destination media library, so you can upload without leaving the page you are working on. Files land in the same library either way.",
      "Pick a Kind first: Image, 360 photo, Audio, Video, 360 video, Drone video, or Transcript. The kind decides which files are accepted and how the viewer treats them later.",
      "Choose your files. You can upload up to 5 files at a time. Insta360 files are supported directly: picking a .insp file switches the kind to 360 photo and a .insv file switches it to 360 video, and the app rewraps them automatically so Cloudinary accepts them.",
      "Check the queued rows before uploading. A row marked Wrong kind means that file's extension does not match the selected kind: change the Kind or remove the file.",
      "Click Upload. Files go straight from your browser to Cloudinary with a progress bar per file. Keep the tab open until every row reads Ready.",
      "Ready is the gate: only files with the Ready status show up in the scene panorama picker and the other media pickers. A file still uploading cannot be placed anywhere.",
      "After upload, give each file a short Display name, a Description, and Tags so you can find it later. The name box starts with the original filename, and the original filename stays listed on the file even after you rename it, so you can always match a library row back to the file on your own machine. As you type a tag, existing tags that match appear below the box — click one to reuse it instead of creating a near-duplicate spelling. For videos, attach a transcript file (.srt, .vtt, or .txt). Without one, deaf and hard-of-hearing visitors cannot use the video at all, and neither can anyone who cannot turn the sound on. It is also required before a course with that video can be published. See /docs/transcripts for what a transcript does for your visitors and for you.",
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
      "Every destination has its own media library. Open a destination from /creator/destinations and scroll to the Destination media library section: Assigned media is what you have placed there on purpose, and Auto-included from your scenes lists media already wired into scenes at that destination. Both count as this tour's media, so the This tour filter in the panorama pickers shows them together: a panorama a scene here already uses is in the tour whether or not you assigned it by hand.",
      "To assign from the destination page, click Add media. Assign one file with its Assign button, or tick the checkboxes on several and click Assign selected to move them in one go. Note: you need at least one of your own scenes at that destination before you can assign media there. Click Unassign to take a file back out.",
      "For bulk work, go to the Media page (/creator/media) and use the tour filter chips at the top: All media, one chip per tour, and Not in any tour. The Not in any tour chip is the fastest way to find strays.",
      "To add several files to a tour at once, tick the checkbox on each file, pick the tour from the tour dropdown, and click Add to tour.",
      "To catch up a whole account in one click, use the Auto-add scene media to tours button. It walks every scene you own and puts each panorama and poster already used in a scene into that scene's tour library.",
      "Uploading from inside a destination assigns the file to that tour for you. There is one exception, and it is the first upload to a brand new tour: a tour has to have at least one scene before media can be assigned to it, because adding a scene is how the app knows the tour is yours to manage. The page tells you when that happens, and creating a scene from the file settles it, since a file a scene uses counts as that tour's media anyway.",
      "After uploading 360 files there, the page offers to create a scene from each one. Take it and you skip the New scene form entirely. It only offers this for 360 photos and 360 videos, because those are the only files a scene can be built from.",
      "Deleting a file that something still uses is refused on purpose, so a tour cannot break quietly. The message names what is holding it, and for a scene it says whether the file is that scene's panorama, its 2D poster, or its ambient sound. If nothing links to that scene you get a button that deletes the scene and then finishes deleting the file in one go. If the scene is connected to others you get the list of connections to remove first, by name, with a link to the Connections page, because deleting a connected scene would leave arrows pointing at nothing.",
      "Long lists stay out of your way. The Assigned and Auto-included lists on the destination page start collapsed behind a Show button with the count on it, and every media grid in the app pages through its files rather than loading hundreds of thumbnails at once. On the media page, Select all visible ticks the files on the page you are looking at.",
      "Re-check the destination page afterwards: the Assigned media list is what courses and tours anchored to that destination will find in one place.",
    ],
    videoScript:
      "As soon as you have more than one tour, you want each tour's media in its own library. Here is how. First, the destination page. Every destination has a Destination media library section with two lists: Assigned media, which is what you placed there on purpose, and Auto-included from your scenes, which is media already wired into scenes at that place. To assign something here, I click Add media. One file? Its Assign button. Several? I tick their checkboxes and click Assign selected, and they all move at once. One rule: you need at least one of your own scenes at the destination before you can assign media to it. And Unassign takes a file back out. Now the bulk tools, over on the Media page. At the top I have tour filter chips: All media, a chip for each of my tours, and Not in any tour. That last chip is my favorite, because it instantly shows me the strays. To move several files at once, I tick their checkboxes, pick a tour from the dropdown, and click Add to tour. Done. And if you have been building tours for a while and nothing is organized yet, there is a one-click catch-up: the Auto-add scene media to tours button. It walks every scene you own and drops each panorama and poster that a scene already uses into that scene's tour library. Then I go back to the destination page and check the Assigned media list, because that is exactly what courses and tours anchored to this place will find. Tidy library, faster building.",
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
      "Open your destination from /creator/destinations, then click the scene's name in the Scenes section. The viewer on that page previews the whole tour, not just this one scene, so you can walk through the arrows into any other room.",
      "Everything on that page follows the room you are standing in: the heading, the Edit scene button, the horizon control, and the publish and share controls all retarget as you walk. So check the heading before you click Edit scene or Publish, because after walking two rooms they act on the room you are looking at, not the one you opened.",
      "Click Edit scene, then scroll to the section called Hotspots and scene links. The panorama list is collapsed by default so the page stays short: open Change panorama only when you actually want to swap the image, and it opens filtered to files in this tour. The 2D poster / thumbnail list below it works the same way: Change poster opens it, and it starts on this tour's images with All my images one click away. You only ever see your own media in either list.",
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
    slug: "add-sound-to-a-scene",
    shortTitle: "Ambient Sound",
    title: "Add ambient sound to a scene",
    summary:
      "Give each scene a looping bed of room tone, birdsong, or gallery hum that crossfades as visitors walk between rooms.",
    audience: "creator",
    steps: [
      "Record the sound of the place. Your 360 camera already captures audio while you shoot, so you often have it. Aim for thirty seconds to two minutes of steady room tone, and avoid anything with an obvious one-off event at the end: a door slam will slam again every time the loop repeats.",
      "Upload it on the Media page with the Kind set to Audio, and wait for the row to say Ready.",
      "Open your destination, click the scene name, then Edit scene. Scroll to the section called Ambient sound.",
      "Click Change sound. The list opens filtered to this tour's audio, with All my media one click away. Every row has a player, so you can listen before you choose.",
      "Select a file and click Save sound. Remove sound takes it back off the scene.",
      "Now walk your tour and check it. Visitors do not hear anything until they press the sound button in the corner of the viewer, so press it yourself and walk between two scenes to hear the crossfade.",
      "One thing to plan for: the sound button only appears when a tour has sound somewhere in it. If you want visitors to hear the place, give the scenes they arrive in a bed, not just the deepest room.",
    ],
    videoScript:
      "Let us give your tour the sound of the place. This is ambient sound: room tone, birdsong, the hum of a gallery. It loops while a visitor stands in a scene and crossfades into the next scene's sound when they walk. It is not narration. A hotspot clip plays because somebody clicked a marker and asked for it. This plays because they arrived. First, the recording. Your 360 camera captures audio while you shoot, so you usually have this already. What you want is thirty seconds to two minutes of steady room tone. Avoid anything with a big one-off event at the end, because a door slam will slam again every single time the loop comes round. Now I upload it on the Media page with the Kind set to Audio, and I wait for the row to say Ready. Then I open my destination, click the scene name, click Edit scene, and scroll to Ambient sound. I click Change sound. The list opens showing this tour's audio first, with All my media one click away, and every row has a player so I can listen before I commit. I pick one and click Save sound. Remove sound takes it back off. Now here is the part people get surprised by: go and look at your tour, and you will hear nothing. That is on purpose. Visitors hear silence until they press the sound button in the corner of the viewer. Two reasons, and they point the same way. Browsers refuse to play audio until someone has interacted with the page, and the accessibility standard we publish against says any audio running longer than three seconds needs a control to stop it. One button does both jobs. So press it yourself, walk between two scenes, and listen to the crossfade. Last tip: that button only shows up when the tour has sound somewhere. Give the rooms visitors actually arrive in a bed, not just the deepest gallery.",
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
      "Open your destination from /creator/destinations and find the Public tour link section. The status pill reads Private until you change it: private tours are invisible to visitors and cannot be embedded. To show a private tour to a client before launch, use the Private preview link below the toggle: Create preview link, copy it, send it. Anyone with the link can view — including scenes you have not published yet, which is the point of a preview. Send the whole link: if the ?k= part is trimmed off by a chat app or email client, they get a Not found page.",
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
    slug: "build-a-scavenger-hunt",
    shortTitle: "Scavenger Hunts",
    title: "Build a scavenger hunt through your tour",
    summary:
      "Turn a tour into something a visitor plays: add stops in order, pick how each one opens, clear the checks that block publishing, and share the link.",
    audience: "creator",
    steps: [
      "Open your destination from /creator/destinations and click Hunts, in the row of buttons next to Connections and New scene. If you see the message 'Add scenes to this destination before building a hunt.', add at least one scene first: a stop always sits in a scene.",
      "Scroll to New hunt. Fill in Hunt title and Introduction (shown before the first stop), then click Create hunt. That drops you straight into the hunt editor, which has four sections in this order: Before you publish, Hunt settings, Stops, and Where scenes are in the world.",
      "Click Add a stop. Give it a Stop title, pick the Scene the visitor is standing in, and write the two pieces of text: Clue (shown before the stop opens) is the prompt, and Reveal (shown after it opens) is the payoff, which is where the actual teaching goes.",
      "Choose How it opens. There are exactly four: 'Freely, once the stop before it is done' needs nothing. 'The visitor types the right answer' reveals an Accepted answers (comma separated) box; case, accents and extra spaces are forgiven, so list every reasonable spelling. 'The visitor holds the right keys' reveals Required keys (comma separated), and the visitor must hold all of them. 'The visitor is physically there' reveals Unlock radius (metres), which starts at 40.",
      "Every stop also has a Grants this key when it opens box, whatever kind it is. Leave it empty unless a later stop, or something hidden elsewhere, should open once this one is done. Click Save when the stop is right.",
      "Stops run strictly in order: a visitor is never offered a stop until the one before it is done, and a locked stop shows a question mark instead of its title. Use Move up and Move down to reorder. Order is load-bearing, not cosmetic: a required key only counts as reachable if something EARLIER grants it, so moving a stop can make a working hunt unfinishable. The checks re-run every time you move one.",
      "Read Before you publish. Problems come in two levels. Errors mean a visitor cannot finish, and they block publishing: the Publish button stays disabled until the count reaches zero. Warnings are judgement calls, they never block, and you can publish straight past them once you have read them.",
      "Clear the errors. 'This hunt has no stops yet.': add a stop. A stop that 'unlocks by arriving somewhere, but its scene has no real-world position': either fill that scene's Latitude and Longitude down in Where scenes are in the world and click Save position, or change How it opens to something that does not need a location. A stop that 'needs the key ... which nothing before it grants': either add that word to an earlier stop's Grants this key when it opens box, or use Move up to bring the granting stop above the stop that needs it.",
      "Two more errors exist but you will rarely see them, because the stop form refuses to save those shapes in the first place: it answers 'An answer stop needs at least one accepted answer.' and 'A key stop needs at least one required key.' The publish check repeats both as a backstop.",
      "Look at the warnings before you ignore them. A radius under 25 metres will fail for visitors standing in exactly the right place, because phone GPS is routinely off by 5 to 20 metres and worse between tall buildings. A stop that reuses a scene an earlier stop already used is allowed but reads to visitors like a bug. An arrival stop with the remote fallback switched off cannot be finished by anyone who cannot travel to it.",
      "Click Publish. The badge on the hunts list flips from Draft to Published. The second badge, Playable anywhere or On site, is worked out from your stops rather than set by you: one arrival stop anywhere in the hunt makes the whole hunt On site, so the badge a visitor sees can never disagree with what the stops actually demand. Unpublish is the same button and is never blocked.",
      "Share the address yourself. A published hunt lives at your tour's address with /hunt/ and the hunt's own slug on the end, like /en/tours/your-tour/hunt/your-hunt-title. That slug is built from the title at the moment you clicked Create hunt and does not move afterwards, so renaming the hunt changes the heading visitors read but not its link. There is no copy-link button for hunts and the public tour page does not list them. The destination has to be public too: a hunt on a private tour returns Not found even for someone holding a private preview link, because a preview link is for showing a tour, not for handing out a game.",
    ],
    videoScript:
      "Let us turn a tour into something a visitor plays. I open my destination and click Hunts, next to Connections and New scene. Every stop lives inside a scene, so add scenes first if we tell you to. I scroll to New hunt, type a title and an introduction, click Create hunt, and I am in the editor: Before you publish, Hunt settings, Stops, and Where scenes are in the world. I click Add a stop. Title, then which scene the visitor is standing in, then two bits of text doing different jobs. The Clue is what they read before it opens. The Reveal is what they read after, and that is where your teaching goes, so do not waste it. Then the interesting choice: How it opens. Freely, once the stop before it is done. Or the visitor types the right answer, which gives me a box for accepted answers, comma separated, and I list every spelling a reasonable person might type, because case and accents and stray spaces are already forgiven. Or the visitor holds the right keys. Or the visitor is physically there, which gives me a radius in metres, starting at forty. Save. Here is what people trip on: stops run in strict order, and a locked one just shows a question mark. So Move up and Move down are not cosmetic. A key only counts as reachable if something earlier hands it out, which means reordering can quietly break a hunt that worked. That is what Before you publish watches. Errors mean nobody can finish, and they hold the Publish button down until you fix them. Warnings never block you. And do not set a radius under twenty five metres, because phone G P S is five to twenty metres out on a good day. I click Publish and the badge flips. That second badge, Playable anywhere or On site, I do not control: one arrival stop makes the whole thing On site, so visitors are never promised something the stops contradict. Last thing, and it catches people: nothing links to your hunt. Its address is your tour's address plus slash hunt slash its slug, and you hand that out yourself. The tour has to be public too.",
    youtubeId: null,
  },

  // -- ARTICLE 2 --------------------------------------------------------------------------------
  // Verified against:
  //   src/db/schema/scenes.ts:104-117   (the "one uniform primitive" comment naming all three
  //     mechanics: easter egg, maze door, clue chain; grantsKey and requiresKeys on hotspots)
  //   src/db/schema/scenes.ts:155-163   (scene_links.requiresKeys, AND the explicit statement that
  //     it is deliberately NOT enforced server-side because a hunt is a game, not access control)
  //   src/components/virtual-tour/virtual-tour-viewer.tsx:143-152 (locked links are OMITTED from
  //     the node, not hidden, because PSV draws an arrow for every link it is handed)
  //   ...:256-264                       (locked hotspot markers are hideMarker'd, so invisible)
  //   ...:573                           (opening a marker carrying grantsKey fires onKeyGranted)
  //   src/lib/actions/hunts.ts:597-638 recordHotspotFind (key resolved SERVER-side from the
  //     hotspot row and stored denormalized; hotspot must belong to this hunt's destination)
  //   src/db/schema/hunts.ts:152-170    (hunt_hotspot_finds exists so a found key survives reload;
  //     grantedKey denormalized so it survives the creator editing the hotspot)
  //   src/lib/hunts.ts:298-320          (unobtainable-key check: earlier stop OR any hotspot in
  //     the destination), :193-202 keysAfter
  //   src/lib/actions/hunts.ts:556-579 resetHuntProgress (Start over clears found hotspots too)
  //   NEGATIVE FINDING, load-bearing for this article: src/lib/actions/hotspots.ts has no
  //     grantsKey/requiresKeys anywhere, and hotspots-editor.tsx's only form fields are title,
  //     __hotspotType, contentHtml, externalUrl, targetDestinationId, toSceneId and name.
  {
    slug: "hidden-hotspots-and-keys",
    shortTitle: "Easter Eggs",
    title: "Hide easter eggs, locked doors and clue chains with keys",
    summary:
      "Keys are the single mechanic behind every hidden thing in a tour: what they unlock, where you can set them today, and why they are not a security control.",
    audience: "creator",
    steps: [
      "A key is just a short word you choose, like vault or red-door. There is no separate setting for secrets, doors or puzzles: one thing hands a key out, another thing asks for it, and every hidden mechanic in a tour is built from that pair.",
      "Three shapes come out of it. An easter egg is a hotspot that stays invisible until the visitor holds the right keys. A locked door or a maze is a scene link that stays shut until they do. A clue chain is a hotspot that grants a key when opened, which then opens a gate somewhere else entirely, in a different scene or in a hunt stop.",
      "Locked things are absent, not greyed out. A locked scene link renders no arrow at all, so there is nothing in the 360 view to click and nothing to tell a visitor they are missing something. A locked hotspot's marker is hidden outright. Both appear the moment the visitor picks up the last key they were missing, without the panorama reloading or the view jumping.",
      "Today you can set keys in exactly one place: on a hunt stop. Open a hunt from your destination's Hunts button, click Add a stop or Edit stop, and use Required keys (comma separated), which appears when How it opens is set to 'The visitor holds the right keys', and Grants this key when it opens, which is on every stop whatever kind it is.",
      "Keys on hotspots and on scene links are not editable from the studio yet. The tour viewer honours them, and a hunt's checks already expect them, but the hotspot editor and the scene link editor have no key fields, so easter eggs and locked doors cannot be switched on from the interface today. Only stop-to-stop chains can. Ask in a support thread before you plan a tour around the other two.",
      "Where a hotspot key does exist, the visitor keeps it. Finding it is recorded server-side, so reloading the page does not lose it, and the key is copied at the moment it is earned, so it survives you renaming or deleting that hotspot afterwards. Nobody halfway through a hunt loses progress to an edit made behind them.",
      "Keys are checked when a hunt is published. A stop that needs a key nothing can hand out is an error and blocks publishing, and the message names the key. A key counts as reachable if an EARLIER stop grants it, or if any hotspot anywhere in that destination grants it. That is why moving a stop up or down re-runs the checks: order is what makes a key obtainable.",
      "Visitors can see what they hold. The hunt page lists their keys under Keys, and a stop they cannot open yet tells them exactly what is missing rather than just refusing. Start over clears found hotspots as well as unlocked stops, so a second run through the hunt actually plays.",
      "Do not use keys as security. This is stated in the code rather than left to be discovered: key gating on links is deliberately not enforced on the server, because a hunt is a game and someone reading the page source can reach a locked scene anyway. That is an accepted outcome for a puzzle. Anything that genuinely must not be reachable belongs behind the destination's own privacy controls instead, not behind a key.",
    ],
    videoScript:
      "Let me explain keys, because once it clicks you realise every hidden thing in a tour is the same mechanic wearing different clothes. A key is just a short word you pick. Vault. Red door. Something hands it out, something else asks for it. That is the whole idea. Out of that one pair you get three shapes. An easter egg, which is a hotspot that stays invisible until the visitor holds the right key. A locked door or a maze, which is a scene link that stays shut until they do. And a clue chain, where opening one hidden thing hands over a key that opens a gate somewhere else, maybe in a hunt stop three steps later. Now the detail that makes this feel good instead of frustrating: locked things are absent, not greyed out. A locked link draws no arrow at all. A locked hotspot's marker is simply not there. Your visitor is not staring at a padlock being told no. And the moment they pick up the key they were missing, the arrow and the marker appear, without the panorama reloading and without losing which way they were facing. Now the honest part, and I would rather you hear it from me than find it. Right now you can set keys in exactly one place: on a hunt stop. Required keys, comma separated, when the stop opens on keys. And Grants this key when it opens, which every stop has. Keys on hotspots and on scene links are not editable in the studio yet. The viewer already honours them and the hunt checks already expect them, but there is no field for them, so easter eggs and locked doors cannot be switched on from the interface today. Stop to stop chains work fine. Ask us in a support thread before you plan a whole tour around the other two. And last: do not use keys as security. That is deliberate. Someone reading the page source can reach a locked scene, and for a game that is fine. If something genuinely must not be reachable, put it behind the tour's privacy controls, not behind a key.",
    youtubeId: null,
  },

  // -- ARTICLE 3 --------------------------------------------------------------------------------
  // Verified against:
  //   src/db/schema/scenes.ts:58-67     (geoLat/geoLng are REAL-WORLD coords, explicitly distinct
  //     from mapX/mapY floor-plan coords; both can be set on the same scene; null is a valid state)
  //   src/lib/actions/hunts.ts:426-473 setSceneGeo (ranges -90..90 / -180..180, and the
  //     "Set both latitude and longitude, or clear both." rule)
  //   src/lib/hunts.ts:53-71 isWithinRadius  (THE ACCURACY WIDENING: effective radius is
  //     unlockRadiusM + Math.max(0, accuracyM); negative accuracy cannot shrink it)
  //   src/lib/hunts.test.ts:58-69       (confirms 111m away fails at 0 accuracy, passes at 100)
  //   src/db/schema/hunts.ts:107-115    (radius default 40 and the reasoning), :125-137 THE
  //     PRIVACY COMMENT ("no column here could hold one"), :182-186 huntProgress columns
  //   src/lib/actions/hunts.ts:477-553 unlockHuntStop (the schema literally has no lat/lng field;
  //     accepts only huntId, stopId, visitorKey, answer, viaFallback. Answers ARE server-checked)
  //   .../hunt-runner.tsx:13-23 (the privacy design comment), :117-138 (watchPosition options and
  //     that it only starts on the Use my location button), :109-115 (watch cleared on unmount),
  //     :34-57 (visitor token: 16 random bytes, localStorage key "wl.hunt.visitor")
  //   dictionaries/en.json tours.hunt  (every visitor string quoted below, incl. privacyNote)
  {
    slug: "location-based-stops",
    shortTitle: "GPS Stops",
    title: "Unlock a stop when the visitor arrives",
    summary:
      "Put a scene on the map, gate a stop on being there, pick a radius that actually works, and understand exactly what does and does not leave the visitor's phone.",
    audience: "creator",
    steps: [
      "Give the scene a real-world position first. In the hunt editor, scroll to Where scenes are in the world, find the scene in the list, and fill Latitude and Longitude, then click Save position. Latitude runs from -90 to 90 and longitude from -180 to 180, and you must fill both or clear both: half a coordinate is rejected.",
      "This is not the tour map. The tour map places scenes on a floor plan image and is built on the Connections page. This is the scene's place on Earth. A museum scene can have both at once, and setting one does nothing to the other.",
      "Now set the stop. Click Edit stop, set How it opens to 'The visitor is physically there', and check Unlock radius (metres). It starts at 40, and it accepts 5 to 2000.",
      "Resist making the radius small. 40 metres is not sloppiness, it is the number that works: consumer GPS is roughly 5 to 20 metres out, and considerably worse between tall buildings. A 10 metre radius reads as precise and then misfires constantly, which trains visitors to reach for the fallback button and makes the whole mechanic pointless. Anything under 25 metres raises a warning before you publish.",
      "The radius grows by the phone's own error estimate, automatically. Every position a browser reports comes with an accuracy figure, and that figure is added to your radius rather than ignored. Someone standing 45 metres from a 40 metre stop on a fix the phone admits could be 30 metres out will unlock, because the device genuinely cannot tell the difference and refusing would strand a visitor who is in fact standing right there. The bias is deliberately toward opening, which is right for a game and would be wrong for anything guarding real access.",
      "Here is what the visitor does. The stop shows 'Turn on location to unlock this stop by arriving.' and a Use my location button, and nothing reads their position until they press it. Once it is on, the stop reports 'About 100m away. Keep going.' and updates as they walk. If they decline, or the phone has no location, they get 'Location is off or was declined. You can still continue below.'",
      "Leave the remote fallback on. In Hunt settings, 'Allow visitors who cannot travel to unlock on-site stops remotely' is on by default and is an accessibility setting, not a convenience toggle. With it on, any stop the visitor cannot reach also offers 'I cannot get there, open it anyway', worded so that using it does not read as cheating, because for a lot of people it is the only way through. Turning it off means nobody with a mobility limitation and nobody outside the area can finish, and it raises a warning on every arrival stop.",
      "Now the privacy model, which is the part to hand to a legal team. The visitor's position is read by their own browser, on their own device, only after they press Use my location. The distance to the stop and the decision about whether they are close enough are both computed in the page, on the device. The location watch stops as soon as they leave the hunt page.",
      "What leaves the phone when a stop opens is exactly this: the hunt's ID, the stop's ID, an opaque token, the typed answer if the stop asked for one, and a flag saying the remote fallback was used if it was. There is no latitude or longitude field in that request. Not an optional one, not an empty one. What gets stored is which stop opened, for which token, whether the fallback was used, and when. There is no column anywhere in this system that could hold a visitor's position.",
      "The token is not an identity. It is 16 random bytes the browser generates and keeps in its own storage, so that reloading the page does not wipe progress. It is not an account, not derived from anything about the device, and not joinable to a user. Typed answers are the one thing checked on the server, because an answer can be checked without learning anything about the visitor, and checking it in the browser would put your answer key in the page source.",
      "Two consequences, stated rather than hidden. A determined visitor can record an unlock without going anywhere, and that is the accepted trade for a teaching game: a hunt carrying a real prize would need a different design, not a location field added to this one. And because no position is ever stored, there can be no map trail, no heatmap, and no report of how close people got. Visitors are told the short version on the hunt page: their location is checked on their device only, and is never sent to us or stored.",
    ],
    videoScript:
      "Let us make a stop that only opens when someone is standing there. Two settings, in two places. First, the scene needs a spot on Earth. In the hunt editor I scroll to Where scenes are in the world, type a latitude and a longitude, and click Save position. Both or neither. And this is not the tour map, which puts scenes on a floor plan on the Connections page. This is the place on the planet, and a room can have both. Second, the stop. Edit stop, set How it opens to the visitor is physically there, and there is my unlock radius in metres, starting at forty. Do not make that small. Forty is the number that works, because phone G P S is five to twenty metres out, and worse between tall buildings. A ten metre radius feels precise and then fails for people standing in exactly the right place, which just teaches them to press the skip button. The phone also reports how wrong it thinks it might be, and we add that to your radius instead of ignoring it. Also leave the remote fallback on. It is in Hunt settings, on by default, and it is accessibility, not convenience: switch it off and nobody with a mobility limitation and nobody outside the area can finish. Now the part your legal team will ask about, so let me be exact. The visitor's location is read by their own browser, on their device, only after they tap Use my location. The distance maths happens right there in the page. When a stop opens, what is sent is the hunt I D, the stop I D, an opaque random token, the typed answer if there was one, and a flag if they used the fallback. There is no latitude or longitude field in that request at all, and no column in our database could store one. That token is sixteen random bytes the browser made up: not an account, not joinable to a person. Two honest consequences. Someone could fake an unlock without walking anywhere, the right trade for a teaching game and the wrong one for a prize. And because we never store a position, we can never show you a trail or a heatmap.",
    youtubeId: null,
  },

  // -- ARTICLE 4 --------------------------------------------------------------------------------
  // Verified against:
  //   src/lib/hunt-map.ts:1-21          (the three stated reasons there is no basemap: no network
  //     where hunts happen, would pick a tile vendor on the operator's behalf, additive later)
  //   ...:53-120 buildProjection        (Web Mercator not raw lat/lng, with the "stretches
  //     east-west by a fifth" reasoning; single scale both axes; MIN_SPAN ~0.002deg ~200m)
  //   ...:126-145 scaleBarFor/formatDistance, :154-174 bearing/bearingWords (the 8 compass words)
  //   src/components/hunt/hunt-map.tsx:18-22 (SVG is aria-hidden BECAUSE the text is the primary
  //     channel, not a fallback), :61-68 (visitor included in framing so they are not clamped to
  //     the edge), :120-149 (dot colors/sizes, numbers, visitor dot), :150-157 (scale bar),
  //     :162-214 (the text channel and the All stops list). NOTE: nothing on this map is
  //     clickable - no links, no handlers. That is a real difference from the tour mini-map.
  //   .../hunt-runner.tsx:191-211, :250-252 (map renders only when >=1 stop has coords; "next" is
  //     the first stop neither done nor sequence-locked)
  //   dictionaries/en.json tours.hunt.map (heading "Where the stops are", noBasemapNote, etc.
  //     CAUTION: the dict defines `youAreHere` but hunt-map.tsx never renders it, so this article
  //     does not claim a "You are here" label exists on screen.)
  //   For the contrast: src/db/schema/scenes.ts:53-57 (mapX/mapY normalized 0..1 on the floor
  //     plan) and the existing tour-map help article's steps.
  {
    slug: "hunt-stop-map",
    shortTitle: "Hunt Map",
    title: "The stop map visitors see on a hunt",
    summary:
      "What the hunt map draws, why it has no streets, and how it differs from the floor-plan mini-map in the corner of your tour.",
    audience: "creator",
    steps: [
      "The hunt map appears on the hunt page under the heading Where the stops are, below the tour viewer. It shows up only when at least one of the hunt's stops sits in a scene that has real coordinates. A hunt played entirely from anywhere simply does not have one, which is correct rather than broken.",
      "It draws your stops as numbered dots joined by a dashed line in stop order, so the shape of the walk is legible at a glance. Finished stops are green, the stop the visitor should be walking toward is amber and drawn slightly larger, and stops still ahead are grey. If the visitor has turned location on, they appear as a blue dot, and the map reframes to fit both them and the stops so that approaching from outside does not pin them to the edge.",
      "Every single thing the picture shows is also written out underneath it, and that is the point rather than a nicety. Next names the stop and reads like '{title} is 450 m to the northeast', using eight plain compass words: north, northeast, east, southeast, south, southwest, west, northwest. A scale line tells you roughly how far the bar represents. All stops lists every stop with its distance and direction from where the visitor is standing. The drawing itself is hidden from screen readers on purpose, because the words are the primary channel and not a fallback.",
      "There is no street basemap, and that is deliberate. The note on the map says so plainly: it shows the stops and how far apart they are, it has no streets, and it works with no signal. A hunt is played outdoors, often exactly where reception is worst, and a map that has to fetch tiles is a map that shows a grey rectangle at the moment someone is lost. This one is drawn from coordinates already on the page, so it renders in airplane mode. Tiles would also mean picking a map vendor, agreeing to their terms and often paying their bill, which is an operator's decision and not one to make quietly inside a component. A basemap can be slid in underneath later without changing any of these marks.",
      "The projection is honest about the shape of the ground. Coordinates are drawn on Web Mercator with north up and one scale on both axes, not plotted as if a degree of longitude equalled a degree of latitude. Across most of the northern hemisphere that shortcut stretches a map east-west by a fifth or more, which is enough to make 'the next stop is that way' point at the wrong thing. If every stop shares one position, it still draws, centred in a window about 200 metres across, rather than collapsing.",
      "Do not confuse it with the tour map, which is a completely different feature. The tour map is the small floor-plan mini-map in the corner of the tour viewer. There is one per destination, you build it on the Connections page under Tour map, it sits on a floor plan image you upload or on a built-in grid, and each scene's pin is positioned as a percentage across that image.",
      "The differences that matter in practice: the tour map is about indoor position on a plan, the hunt map is about real latitude and longitude outdoors. The tour map is per destination and shows every placed scene, the hunt map is per hunt and shows only that hunt's stops. Tapping a pin on the tour map jumps the visitor to that scene, while nothing on the hunt map is clickable at all: it tells you where to walk, it does not navigate. The tour map follows visitors as they move between scenes, the hunt map tracks progress through the stop list.",
      "A scene can appear on both, and one has no effect on the other. Placing a pin on the floor plan does not give a scene a real-world position, and typing latitude and longitude does not put it on the floor plan. A museum scene legitimately has a place on the building plan and a place on Earth, so if you want both, set both.",
    ],
    videoScript:
      "Let me show you the map visitors get during a hunt, and clear up the confusion with the other map, because we have two and they do different jobs. This one appears on the hunt page under Where the stops are, just below the tour viewer, and only if at least one stop sits in a scene with real coordinates. A hunt you play from your sofa does not get one, and that is correct. It draws your stops as numbered dots joined by a dashed line in order, so you can see the shape of the walk. Green means done. Amber, slightly bigger, is the one they should be heading for. Grey is still ahead. If they have turned location on, they show up as a blue dot, and the map reframes to fit both them and the stops, so walking in from outside does not squash you against the edge. Now the part I am proudest of. Everything that picture shows is also written out in words underneath. Next tells you the stop, the distance, and the direction in plain language, northeast, southwest, and so on. There is a scale line. And All stops lists every stop with how far and which way. The drawing itself is hidden from screen readers deliberately, because the words are the real channel, not a consolation prize. Now, no streets. That is on purpose. A hunt happens outdoors, usually where signal is worst, and a map that downloads tiles is a map that shows a grey box the moment you are lost. This one is drawn from numbers already on the page, so it works in airplane mode. Tiles would also mean picking a map vendor and paying their bill, and that is your call, not ours to make quietly. We can slide a basemap underneath later without changing a mark. Finally, do not mix this up with the tour map. That is the little floor plan in the corner of the viewer, one per destination, built on the Connections page, and tapping a pin jumps you to that room. This one is per hunt, uses real latitude and longitude, and nothing on it is clickable. It tells you where to walk. It does not take you there.",
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
      "Hero and card images show their recommended size right in the picker: 16 by 9, at least 1600 by 900 for the wide hero, 800 by 450 for the small card image. Optionally add a Website link and a YouTube video link. The YouTube link turns the public page into a video tour.",
      "Under Tour styling, pick a Tour type (it sets the pin color on the globe) and, if you like, custom colors for the scene-link arrows and hotspot pins. You can also set their size in pixels — leave the size boxes blank for the defaults, or raise them if the icons read too small against a busy panorama.",
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
      "Open the scene visitors arrive AT, not the one they leave from: /creator/destinations, click the destination, click the scene's name, then Edit scene. If you walked through the tour preview to get there, check the heading first — Edit scene opens whichever room you are standing in, not the one you originally clicked.",
      "Scroll to How visitors arrive here. It lists every scene that links into this one. If the list is empty, nothing links here yet, so there is nothing to set.",
      "Drag the 360 viewer at the top of the page until you are facing the direction someone should be looking when they arrive from a particular scene. You do not have to drag: the Nudge buttons turn the view 90 degrees left or right and 15 degrees up or down, and Copy start view from another scene lifts the exact angle off a scene you already tuned — handy when a whole shoot was captured facing the same way.",
      "Click Capture current view on the row for that scene. The row now shows the saved yaw and pitch.",
      "Repeat per route. A gallery reached from the lobby and from the courtyard should usually face two different ways, and that is the whole point of doing this per link.",
      "Click Clear on any row to go back to the scene's own start view, which is the behavior you had before.",
      "Walk your tour both directions to check it. This is a feel change, so it is judged by walking it, not by looking at numbers. The new scene now opens already facing the direction you set — there is no visible spin on arrival.",
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
      "Fine-tune each pin three ways. Click Place by clicking on a scene row, then click the exact spot on the map. Or tap a pin to select it and step it with the Left, Right, Up and Down buttons, using the times-five buttons to move in bigger jumps; Previous scene and Next scene cycle the selection so you never have to hunt for a small pin. Or type exact x and y percent values in the fields and Save. Once a pin is selected you can also just use the arrow keys, holding Shift for a bigger step. Nudges save when you pause, not on every press.",
      "Moving pins is safe: pin position and connections are separate, so rearranging the whole map never changes, breaks or removes a single connection or arrow.",
      "Remove takes a scene off the map. Scenes not on the map simply do not appear in the visitor mini-map; the tour itself is unaffected.",
      "View your public tour: the mini-map sits in the corner of the viewer. It follows visitors as they move, and tapping a pin jumps to that scene. Scenes are only shown once placed, so you can build the map gradually.",
    ],
    videoScript:
      "Let us give your visitors a you-are-here map. Open your destination, click Connections, and scroll down to Tour map. First decision: the background. The best map is a real floor plan, and any image works — a scan of the building plan, an illustration, something you drew in any drawing app. There is an upload box right here, so you do not have to leave the page: upload, then select it. No floor plan? No problem. Pick the built-in grid or the blank canvas, because the numbered pins are about to become the map themselves. One note: if an older image refuses with a message about missing dimensions, re-upload it once. Older uploads predate the size information the map needs. Now the fun part. Click Arrange scenes automatically, and every scene lands on the map laid out by how your rooms connect, starting from your start scene. Treat it as a draft, and an important one to correct: it lays scenes out by how many doors they are from your start scene, not by where the rooms actually are, so on a real floor plan it will look wrong until you move things. To fine-tune, you have three routes. Click Place by clicking on a scene row, then click the exact spot on the map where that room lives. Or tap a pin to select it and walk it into place with the direction buttons, using the times-five buttons for bigger jumps, and Previous scene and Next scene to move through your scenes in order. Or type exact x and y percent values. Once a pin is selected the arrow keys work too, and holding Shift makes each step bigger. And do not worry about breaking anything: moving pins never changes your connections. Position and connection are separate, so you can rearrange the entire map and every arrow stays exactly as you set it. Remove takes a scene off the map without touching the tour. And here is what visitors get: a small round map in the corner of the tour that follows them as they move, where tapping any pin jumps straight to that room. Scenes only appear once you have placed them, so you can build the map gradually and publish when it feels right.",
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
