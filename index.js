const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const monk = require("monk");
const yup = require("yup");
const { nanoid } = require("nanoid");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(helmet());
app.use(morgan("tiny"));
app.use(express.static("./public"));

const notFoundPath = path.join(__dirname, "public/404.html");

const db = monk(process.env.MONGODB_URI);
const urls = db.get("urls");

const schema = yup.object().shape({
  slug: yup
    .string()
    .trim()
    .matches(/^[\w\-]+$/i),
  url: yup.string().trim().url().required(),
});

app.get("/:id", async (req, res, next) => {
  const { id: slug } = req.params;
  try {
    const url = await urls.findOne({ slug });
    if (url) {
      return res.redirect(url.url);
    }
    return res.status(404).sendFile(notFoundPath);
  } catch (error) {
    return res.status(404).sendFile(notFoundPath);
  }
});

app.post("/", async (req, res, next) => {
  let { slug, url } = req.body;
  if (!slug || slug.trim() === "") {
    slug = nanoid(6);
  }
  slug = slug.toLowerCase().trim();
  url = url.trim();
  try {
    await schema.validate({
      slug,
      url,
    });
    if (!slug) {
      slug = nanoid(6);
    } else {
      const existing = await urls.findOne({ slug });
      if (existing) {
        throw new Error("Slug in use.");
      }
    }
    slug = slug.toLowerCase();
    const newUrl = {
      url,
      slug,
    };
    const created = await urls.insert(newUrl);
    res.json(created);
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  res.status(404).sendFile(notFoundPath);
});

app.use((error, req, res, next) => {
  if (error.status) {
    res.status(error.status);
  } else {
    res.status(500);
  }
  res.json({
    message: error.message,
  });
});

const port = process.env.PORT || 1337;
app.listen(port, () => {
  console.log(`Listening at Port : ${port}`);
});
