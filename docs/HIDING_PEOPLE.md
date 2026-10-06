# Hiding people and camera gear

A 360° camera records every direction at once. That includes the person holding it, the tripod under it, and anyone who walked past while it fired. This guide covers the ways to keep them out of a Wanderlust scene, what each one really hides, and when to use which.

Checked against the app and the vendors' own documentation on 6 October 2026.

## Start here: looks or privacy?

Two questions decide the tool.

- **Is it about looks, or about privacy?** Hiding the tripod is about looks. Hiding a person who did not agree to be in the tour is about privacy. A privacy fix has to change the photo itself, because anything the viewer only avoids showing is still in the file that reaches the visitor's browser.
- **Where is it?** The camera operator and the tripod sit directly under the lens, at the bottom of the view. Bystanders can be anywhere.

| What you are hiding | Best option | Why |
| --- | --- | --- |
| The tripod, or your own feet and head under the camera, for looks | **Limit how far down visitors can look** | Two minutes, nothing to edit, works on 360° video too |
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
- **Visitors lose the floor.** In a room where the floor matters, such as a mosaic or a plaque set into the ground, choose a smaller limit.

## Habits at capture time

- **Get out of the shot.** Start the camera from the Insta360 app on your phone, or use the timer, and step behind a wall or into the next room before it fires.
- **Use the invisible selfie stick, and know what it hides.** Insta360 sells the X5 with what it calls an invisible selfie stick effect (Insta360, 2026). It hides the stick. It does not hide the hand, arm, and head of the person holding it, which is why a handheld shot still needs one of the fixes in this guide.
- **Stamp a logo over the bottom when you export.** The Insta360 app can place a logo at the bottom of 360° media. It is under **Me**, then **Watermark Setting**, then **360 Bottom Logo** (Insta360, n.d.). The manual walks through it on a video, so check that your app version offers it for photos before you rely on it.
- **In a busy room, shoot several frames and keep what stayed still.** Put the camera on a stand, take a series of shots a few seconds apart over a few minutes, and median-blend them. Every spot in the result keeps the value it showed in most of the shots, so people who moved through the room disappear and the real room takes their place (David, 2013). It needs movement to work: someone who sat in one chair the whole time stays in the picture, and a person who lingered can leave a faint blur (Bourke, 2024). Photo editors with a median stack mode can do it, and so can the free ImageMagick. This is the command David (2013) uses:

  ```
  convert *.jpg -evaluate-sequence median OUT.jpg
  ```

  On ImageMagick 7 the command starts with `magick` instead of `convert`. Every frame must line up, so use a stand rather than holding the camera.

## References

Bourke, P. (2024). *Removing tourists from photographs*. https://paulbourke.net/miscellaneous/removing_tourists

David, P. (2013, May 6). *Noise removal in photos with median stacks (GIMP/G'MIC & Imagemagick)*. https://patdavid.net/2013/05/noise-removal-in-photos-with-median_6/

Insta360. (n.d.). *Insta360 app: Adding or removing watermarks*. https://onlinemanual.insta360.com/app/en-us/operation-tutorial/file-export/watermarks

Insta360. (2026). *Insta360 X5*. https://store.insta360.com/product/x5

Sorel, D. (n.d.). *VisibleRangePlugin*. Photo Sphere Viewer. https://photo-sphere-viewer.js.org/plugins/visible-range.html
