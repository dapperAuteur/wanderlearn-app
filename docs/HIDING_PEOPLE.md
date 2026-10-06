# Hiding people and camera gear

A 360° camera records every direction at once. That includes the person holding it, the tripod under it, and anyone who walked past while it fired. This guide covers the ways to keep them out of a Wanderlust scene, what each one really hides, and when to use which.

Checked against the app and the vendors' own documentation on 6 October 2026. For the same options laid side by side with their pros and cons, read [Seven ways to hide someone in a 360 photo](https://brandanthonymcdonald.com/blog/seven-ways-to-hide-someone-in-a-360-photo).

## Start here: looks or privacy?

Two questions decide the tool.

- **Is it about looks, or about privacy?** Hiding the tripod is about looks. Hiding a person who did not agree to be in the tour is about privacy. A privacy fix has to change the photo itself, because anything the viewer only avoids showing is still in the file that reaches the visitor's browser.
- **Where is it?** The camera operator and the tripod sit directly under the lens, at the bottom of the view. Bystanders can be anywhere.

| What you are hiding | Best option | Why |
| --- | --- | --- |
| The tripod, or your own feet and head under the camera, for looks | **Limit how far down visitors can look** | Two minutes, nothing to edit, works on 360° video too |
| The tripod or the person holding the camera, gone from the photo itself | **Cover the bottom** with a patch | Covers them completely, and the floor stays visible everywhere else |
| A bystander who must not be seen | **Boxes**, saved **everywhere**, then delete the original permanently | The only route that removes the person from every copy Wanderlust serves |
| A person you would rather remove than blur, accepting pixels made by AI | **Remove people with generative AI** | Takes them out instead of leaving a blur, at the cost of invented pixels and a label visitors see |
| A crowd too big to box one by one | Reshoot with **several frames and a median blend**, or box the people closest to the camera | Automatic face blur misses most faces in a panorama |
| People in a 360° video | A video editor that tracks a mask, before you upload | Cloudinary's face and region effects are for images |
| Anything, before it happens | **Habits at capture time** | The cheapest fix is the one you never have to make |

## Limit how far down visitors can look

Every scene has a **Hide people and gear** page. Open the scene from your destination, then select **Hide people and gear** under the **Edit scene** button. The same link sits at the top of the scene editor.

1. Tick **Limit the view in this scene**.
2. Drag **Lowest view** while you look straight down in the viewer above it. Stop when the tripod or your own head is no longer on screen. The viewer follows the slider, so you see exactly what visitors will see.
3. Select **Save limit**.

What it does:

- The viewer stops the camera before the bottom edge of the screen reaches the angle you set, at every zoom level. It uses the visible range plugin of Photo Sphere Viewer, which shrinks the allowed range by half of the field of view so the edge of the screen, not just its centre, respects the limit (Sorel, n.d.).
- Visitors can still turn all the way around and look up.
- It is per scene, so a room shot from a tripod and a room shot handheld can have different limits, or none.
- It works on 360° photos and on 360° video.
- When a visitor walks into a scene that has a limit, they arrive already inside it, so the hidden part never flashes past during the fade.

What it does not do:

- **It does not change the photo.** The full image still downloads to the visitor's browser, and anyone who saves it can see the bottom. Use it for gear and for looks. Do not use it to protect a person.
- **Visitors lose the floor.** In a room where the floor matters, such as a mosaic or a plaque set into the ground, choose a smaller limit, or cover the bottom instead.

## Edit the photo in Wanderlust

For 360° photos, the same page has an **Edit the photo** section. Nothing changes while you work. When you save, Wanderlust asks Cloudinary to make an edited copy, stores it as a new file, and swaps it in. The original stays in your media library until you delete it.

### Boxes: the reliable way to hide a person

1. Select **Click to add boxes**, right under the viewer.
2. Click each person in the viewer. A box appears where you click, outlined in the viewer and listed under **People and things, one box each**.
3. Resize each box with its **Width** and **Height** sliders until it covers the whole person. Widths and heights are in degrees, the way a 360° photo is measured.
4. Choose whether boxes are **Pixelated** or **Blurred**.
5. Select **Stop adding boxes** when you are done.

A few notes:

- **Keyboard route.** Turn the viewer with the arrow keys until the person is in the middle of the screen, then select **Add a box at the center of the view**. Each box also has **Move to the center of the view**.
- **Moving a box.** Select **Move by clicking** on the box, then click its new spot in the viewer.
- **Boxes cross the seam.** A box near the left or right edge of the photo carries on round the other side, because those edges are the same place in the room.
- **Up to 24 boxes** per photo.
- **Cover the whole person.** Clothes, tattoos, a bag, or a voice in the same scene can identify someone whose face is hidden.

### Faces: a first pass, not the answer

**Faces** blurs or pixelates every face Cloudinary's face detection finds in the photo (Cloudinary, n.d.-a). Treat it as a first pass. When we tested it on a 5900 by 2950 panorama of a busy convention room, it found none of a dozen visible faces at full size. People in a wide panorama are small, and many are turned away. It can also find a face where you do not want one: run on smaller sections of the same photo, it pixelated a face in a framed photograph on the wall and still missed the people, which matters in a museum. Always check the preview, and box anyone it misses.

### Cover the bottom

**Cover the bottom** hides the floor straight under the camera, where the tripod and the person holding it are.

- **Blur** and **Pixelate** hide detail but leave dark shapes behind: a strongly blurred tripod still reads as three dark smudges.
- **Patch** covers the area with a solid colour, with a logo from your media library in the middle if you choose one. Square logos on a transparent background work best. Looking straight down, visitors see a round disc with the logo the right way up when they face the scene's forward direction.
- **How much to cover** sets the size, in degrees up from straight down. The viewer draws a dashed ring where the cover will end.

### Remove people with generative AI

Wanderlust's content policy is that every pixel comes from someone who stood in the place. Removing people is the one exception, and it comes with a label.

Cloudinary's generative remove takes a person out of the photo and paints in what it guesses was behind them (Cloudinary, n.d.-b). There are two ways to use it:

- Set the box style to **Removed with generative AI**. Every box is sent to the AI instead of being blurred.
- Tick **Remove every person the AI finds** under **Remove people with generative AI**.

Either way, you must also tick the acknowledgement before **Preview the edit** or saving will work. Then:

- **Visitors see a label.** Any scene or lesson that shows the edited photo carries the text "Edited with AI: people were removed from this photo." It cannot be turned off.
- **The file is marked.** The edited copy shows **Edited with AI** in your media library.
- **Use it on whole people.** Cloudinary advises against removing just faces or hands, and very small or very large objects may not be found (Cloudinary, n.d.-b).
- **Check for smears.** In our test on a busy convention room, it took out nearly every person at once, and left blurred, smeared patches where the crowd had been.
- **It takes longer and costs more.** Each new version counts as 50 transformations on the Cloudinary account (Cloudinary, n.d.-c), and a first request can report that Cloudinary is still working. Wait a minute and try again.
- **Large photos are scaled down** to at most 6140 pixels across while the AI works (Cloudinary, n.d.-b).

### Preview, then save

1. Select **Preview the edit**. Cloudinary makes the preview from the full-size photo, so it takes a few seconds. The viewer switches to it. Use **Show the original** under the viewer to compare.
2. Look all the way around, including straight down.
3. Under **Save the edited photo**, choose where the edited copy goes:
   - **Everywhere this photo is used, including lessons** is the one to use for privacy. A person hidden in one scene but visible as the tour's hero image, or in a lesson, is not hidden.
   - **Only this scene** leaves every other use of the photo alone.
4. To remove the original entirely, tick **Then delete the original permanently from Cloudinary**. It only happens if nothing else still uses the original, and it cannot be undone.
5. Select **Save as a new photo and swap it in**. It can take up to a minute.

After saving:

- The edited copy appears in your media library with "(edited)" after its name.
- **Edits start from the original.** Open the page again and your boxes and settings are still there. Change them and save, and Wanderlust rebuilds the edit from the original, so blur never stacks on blur. The previous edited copy is removed once nothing uses it.
- **Swap back** puts the original back everywhere the edited copy is used. The edited copy stays in your library.
- If you deleted the original, new edits are made on top of the edited copy.
- **Deleting by hand.** In the media library, **Delete** on its own hides a file from the library but keeps it in Cloudinary. For privacy, choose **Delete permanently from Cloudinary**, which removes the file and clears Cloudinary's cached copies.
- Copies made before the edit, such as a screenshot someone took or a course saved on a device for offline use, are outside Wanderlust's reach.

## Do it by hand in Cloudinary

Every edit the app makes is a Cloudinary transformation: a short instruction placed in the image's web address (Cloudinary, n.d.-d). You can do the same thing yourself, for example to edit a photo outside the app's limits or to check what the app did.

1. In the media library, open **Preview** on the photo and select **Open the full image**. The address looks like this, with a version number after `/upload/` and the file's own name at the end:

   ```
   https://res.cloudinary.com/<cloud>/image/upload/v1700000000/wanderlearn/media/<file-id>.jpg
   ```

2. Add one or more instructions right after `/upload/`, separated by `/`, and end them with a `/`. They run in order.
3. Open the new address. When it looks right, save the image and upload it to Wanderlust as a new **360 photo**.
4. In the media library, use **Replace with…** on the original to swap the new file into the places you choose, then delete the original with **Delete permanently from Cloudinary**.

The instructions the app uses:

| To do this | Add this | Notes |
| --- | --- | --- |
| Pixelate every detected face | `e_pixelate_faces:30` | Square size 1 to 200 pixels. A first pass only |
| Blur every detected face | `e_blur_faces:1500` | Strength 1 to 2000 |
| Pixelate one box | `e_pixelate_region:40,x_0.4500,y_0.4000,w_0.0500,h_0.2500` | x, y, w, h are shares of the width and height, measured from the top left |
| Blur one box | `e_blur_region:2000,x_0.4500,y_0.4000,w_0.0500,h_0.2500` | Strength 1 to 2000 |
| Blur everything below a line | `e_blur_region:2000,y_0.8500` | `y_0.85` covers the bottom 15% of the image, about 27° up from straight down |
| Remove every person, with generative AI | `e_gen_remove:prompt_person;multiple_true` | Paints in new pixels. Label the scene for visitors |
| Remove what is inside one box, with generative AI | `e_gen_remove:region_((x_340;y_330;w_80;h_200))` | Regions are in **pixels**, not shares. Separate several with `;` inside the outer brackets |
| Save as a JPEG at good quality | `f_jpg,q_auto:good` | Put this last |

A few rules that save time:

- **Write shares with a decimal point.** Cloudinary reads `0.25` as a quarter of the image and `25` as 25 pixels. A full width is `1.0`, never `1`.
- **For several boxes, chain them:** `e_pixelate_region:40,x_...,y_.../e_pixelate_region:40,x_...,y_...`. In our testing, 48 boxes in one address still worked.
- **To find x and y,** 0 is the left and top edge and 1 the right and bottom. The middle of the image is the direction the camera faced, and the bottom row is straight down.
- **A box across the left or right edge** needs two boxes, one at each edge.
- **A logo laid flat over the bottom does not work.** It shows up as a wedge, not a disc. The patch in the app is a logo unwrapped around the floor first. Use the app for a logo patch.
- **Each new address is a new version** that Cloudinary has to make, and it counts toward the account's monthly transformations. A generative remove counts as 50 (Cloudinary, n.d.-c). Preview a few, not dozens.
- **If you use generative remove by hand,** the photo needs the same disclosure the app gives it. Upload it through Wanderlust's **Hide people and gear** page instead if you can, so the label is applied for you.
- **Wanderlust accepts images up to 10 MB.** A 6K panorama saved with `q_auto:good` is usually well under that.

## 360° video

The view limit works on 360° video exactly as it does on photos. Editing people out of the footage itself has to happen before upload: Cloudinary documents face and region blur for images, and for video it documents blurring the whole frame (Cloudinary, n.d.-d, n.d.-e).

- Use a video editor that can track a moving mask, blur inside it, and export equirectangular video. Then upload the result.
- The Insta360 app's bottom logo works on 360° video (Insta360, n.d.).
- Wanderlust accepts 360° video files up to 100 MB, so trim before you upload.

## Habits at capture time

- **Get out of the shot.** Start the camera from the Insta360 app on your phone, or use the timer, and step behind a wall or into the next room before it fires.
- **Use the invisible selfie stick, and know what it hides.** Insta360 sells the X5 with what it calls an invisible selfie stick effect (Insta360, 2026). It hides the stick. It does not hide the hand, arm, and head of the person holding it, which is why a handheld shot still needs one of the fixes in this guide.
- **Stamp a logo over the bottom when you export.** The Insta360 app can place a logo at the bottom of 360° media. It is under **Me**, then **Watermark Setting**, then **360 Bottom Logo** (Insta360, n.d.). The manual walks through it on a video, so check that your app version offers it for photos before you rely on it.
- **In a busy room, shoot several frames and keep what stayed still.** Put the camera on a stand, take a series of shots a few seconds apart over a few minutes, and median-blend them. Every spot in the result keeps the value it showed in most of the shots, so people who moved through the room disappear and the real room takes their place (David, 2013). It needs movement to work: someone who sat in one chair the whole time stays in the picture, and a person who lingered can leave a faint blur (Bourke, 2024). Photo editors with a median stack mode can do it, and so can the free ImageMagick. This is the command David (2013) uses:

  ```
  convert *.jpg -evaluate-sequence median OUT.jpg
  ```

  On ImageMagick 7 the command starts with `magick` instead of `convert`. Every frame must line up, so use a stand rather than holding the camera.

## Further reading

- [Seven ways to hide someone in a 360 photo](https://brandanthonymcdonald.com/blog/seven-ways-to-hide-someone-in-a-360-photo): every option compared, with when and how to use each.
- [I was in every 360 photo I took](https://brandanthonymcdonald.com/blog/i-was-in-every-360-photo-i-took): how the tools in this guide came to be, and a walk through them.

## References

Bourke, P. (2024). *Removing tourists from photographs*. https://paulbourke.net/miscellaneous/removing_tourists

Cloudinary. (n.d.-a). *Face-detection based transformations*. https://cloudinary.com/documentation/face_detection_based_transformations

Cloudinary. (n.d.-b). *Generative remove*. https://cloudinary.com/documentation/generative_remove

Cloudinary. (n.d.-c). *Transformation counts*. https://cloudinary.com/documentation/transformation_counts

Cloudinary. (n.d.-d). *Transformation URL API reference*. https://cloudinary.com/documentation/transformation_reference

Cloudinary. (n.d.-e). *Video artistic effects*. https://cloudinary.com/documentation/video_artistic_effects

David, P. (2013, May 6). *Noise removal in photos with median stacks (GIMP/G'MIC & Imagemagick)*. https://patdavid.net/2013/05/noise-removal-in-photos-with-median_6/

Insta360. (n.d.). *Insta360 app: Adding or removing watermarks*. https://onlinemanual.insta360.com/app/en-us/operation-tutorial/file-export/watermarks

Insta360. (2026). *Insta360 X5*. https://store.insta360.com/product/x5

Sorel, D. (n.d.). *VisibleRangePlugin*. Photo Sphere Viewer. https://photo-sphere-viewer.js.org/plugins/visible-range.html
