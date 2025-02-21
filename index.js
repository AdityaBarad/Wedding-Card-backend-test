const express = require("express");
const puppeteer = require("puppeteer");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();


const app = express();
app.use(express.json());
app.use(cors());

console.log("Supabase URL:", process.env.VITE_SUPABASE_URL);
console.log("Supabase Key:", process.env.VITE_SUPABASE_ANON_KEY);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET_NAME = "cards";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.get("/", (req, res) => {
    res.send("Render Puppeteer server is up and running!");
  });

app.post("/generate-invitations", async (req, res) => {
    console.log("Supabase URL:", process.env.VITE_SUPABASE_URL);
console.log("Supabase Key:", process.env.VITE_SUPABASE_ANON_KEY);
    const browser = await puppeteer.launch({
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--single-process",
          "--no-zygote",
        ],
        executablePath:
          process.env.NODE_ENV === "production"
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
      });
      console.log("Supabase URL:", process.env.VITE_SUPABASE_URL);
console.log("Supabase Key:", process.env.VITE_SUPABASE_ANON_KEY);
  const { projectId, guestName } = req.body;
  console.log("Received projectId:", projectId, "Guest Name:", guestName);

  try {
    // Fetch all required data in parallel to speed up execution
    const [{ data: project, error: projectError }, { data: guest, error: guestError }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("guests").select("*").eq("project_id", projectId).eq("name", guestName).single(),
    ]);

    if (projectError || !project) return res.status(400).json({ error: "Project not found" });
    if (guestError || !guest) return res.status(400).json({ error: "Guest not found" });

    // Skip if the invitation already exists
    if (guest.invitation_image_url) {
      console.log(`Invitation already generated for: ${guest.name}`);
      return res.json({ name: guest.name, imageUrl: guest.invitation_image_url });
    }

    // Fetch template in parallel
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("*")
      .eq("id", project.template_id)
      .single();

    if (templateError || !template) return res.status(400).json({ error: "Template not found" });

    // Reuse Puppeteer browser instance
    const page = await browser.newPage();

    // Set page size to match a standard greeting card (for example, 4:3 aspect ratio)
    const width = 1200;  // Adjust width to match your card's layout
    const height = 900;  // Adjust height to match your card's layout

    // Set the viewport size to the greeting card dimensions
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    console.log(`Generating invitation for: ${guest.name}`);
    const guestHtml = template.html_content.replace("{{GUEST_NAME}}", guest.name);

    // Optimize Puppeteer rendering
    await page.setContent(guestHtml, { waitUntil: "networkidle0" });

    // Capture only the required section of the page
    const element = await page.$(".invitation"); // Select the invitation div

    // Take a screenshot with adjusted dimensions
    const imageBuffer = await element.screenshot({
      type: "jpeg",
      quality: 100,
    });

    await page.close(); // Close the page instead of the whole browser

    // Upload image to Supabase Storage asynchronously
    const filePath = `invitations/${projectId}/${guest.name}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, imageBuffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) return res.status(500).json({ error: "Failed to upload invitation image" });

    // Get the public URL
    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    const imageUrl = publicUrlData?.publicUrl;

    if (imageUrl) {
      // Update the guest's invitation image URL asynchronously
      supabase.from("guests").update({ invitation_image_url: imageUrl }).eq("id", guest.id);
    }

    res.json({ name: guest.name, imageUrl });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Failed to generate invitation" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));