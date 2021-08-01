const { Product } = require("../models/product");
const express = require("express");
const { Category } = require("../models/category");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const Storage = require("../helpers/storage");
const ResponseController = require("../helpers/response-controller");

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const storage = Storage.buildStorage();

const uploadOptions = multer({ storage: storage });

getAllProducts();
getProduct();
getNumberOfProducts();
getNumberOfFeaturedProducts();
postProduct();
updateProduct();

function getAllProducts() {
  router.get(`/`, async (req, res) => {
    let filter = _filterProducts(req);

    const productList = await _getAllProductsFromMongoDB(filter);

    ResponseController.sendResponse(
      res,
      productList,
      "The product list is empty"
    );
  });
}

function _filterProducts(req) {
  if (req.query.categories) {
    return { category: req.query.categories.split(",") };
  }
  return {};
}

function _getAllProductsFromMongoDB(filter) {
  return Product.find(filter).populate("category");
}

function getProduct() {
  router.get(`/:id`, async (req, res) => {
    const product = await _getProductFromMongoDB();

    ResponseController.sendResponse(
      res,
      product,
      "The category with given ID does not exist"
    );
  });
}

function _getProductFromMongoDB(req) {
  return Product.findById(req.params.id).populate("category");
}

function getNumberOfProducts() {
  router.get(`/get/count`, async (req, res) => {
    const productCount = await _getNumberOfProductsFromMongoDB();

    ResponseController.sendResponse(res, productCount, "There are no products");
  });
}

function _getNumberOfProductsFromMongoDB() {
  return Product.countDocuments((count) => count);
}

function getNumberOfFeaturedProducts() {
  router.get(`/get/featured/:count`, async (req, res) => {
    const count = req.params.count ? req.params.count : 0;
    const products = await _getNumberOfFeaturedProductsFromMongoDB(count);

    if (!products) {
      res.status(500).json({ success: false });
    }
    res.send(products);
  });
}

function _getNumberOfFeaturedProductsFromMongoDB(count) {
  return Product.find({ isFeatured: true }).limit(+count);
}

function postProduct() {
  router.post(`/`, uploadOptions.single("image"), async (req, res) => {
    const category = await _getCategoryFromMongoDB(req);

    ResponseController.validateExistence(res, category, "Invalid Category");

    const file = req.file;

    ResponseController.validateExistence(res, file, "No image in the request");

    const fileName = file.filename;
    const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;
    const URL = `${basePath}${fileName}`;
    let product = _createProduct(req, URL);
    product = await _saveProductFromMongoDB(product);
    ResponseController.validateExistence(
      res,
      product,
      "The product cannot be created"
    );
    res.send(product);
  });
}

function _getCategoryFromMongoDB(req) {
  return Category.findById(req.body.category);
}

function _createProduct(req, URL) {
  return new Product({
    name: req.body.name,
    description: req.body.description,
    image: URL, // "http://localhost:3000/public/upload/image-2323232"
    price: req.body.price,
    category: req.body.category,
    countInStock: req.body.countInStock,
    isFeatured: req.body.isFeatured,
  });
}

function _saveProductFromMongoDB(product) {
  return product.save();
}

function updateProduct() {
  router.put("/:id", uploadOptions.single("image"), async (req, res) => {
    ResponseController.validateExistence(
      res,
      mongoose.isValidObjectId(req.params.id),
      "Invalid product id"
    );

    const category = await Category.findById(req.body.category);
    ResponseController.validateExistence(res, category, "Invalid category");

    const product = await Product.findById(req.params.id);
    ResponseController.validateExistence(res, product, "Invalid product");

    const file = req.file;
    let imagePath = _validateFileUpdate(req, file, product);

    const updatedProduct = await _updateProductFromMongoDB(req, imagePath);

    if (!updatedProduct)
      return res.status(500).send("the product cannot be updated!");

    res.send(updatedProduct);
  });
}

function _validateFileUpdate(req, file, product) {
  if (file) {
    const fileName = file.filename;
    const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;
    return `${basePath}${fileName}`;
  } else {
    return product.image;
  }
}

function _updateProductFromMongoDB(req, imagePath) {
  return Product.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      description: req.body.description,
      image: imagePath,
      price: req.body.price,
      category: req.body.category,
      countInStock: req.body.countInStock,
      isFeatured: req.body.isFeatured,
    },
    { new: true }
  );
}

function upsertProductImages() {
  router.put(
    "/gallery-images/:id",
    uploadOptions.array("images", 10),
    async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).send("Invalid Product Id");
      }
      const files = req.files;
      let imagesPaths = [];
      const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;

      if (files) {
        files.map((file) => {
          imagesPaths.push(`${basePath}${file.filename}`);
        });
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        {
          images: imagesPaths,
        },
        { new: true }
      );

      if (!product)
        return res.status(500).send("the gallery cannot be updated!");

      res.send(product);
    }
  );
}

function deleteProduct() {
  router.delete("/:id", (req, res) => {
    Product.findByIdAndRemove(req.params.id)
      .then((product) => {
        if (product) {
          return res.status(200).json({
            success: true,
            message: "the product is deleted!",
          });
        } else {
          return res
            .status(404)
            .json({ success: false, message: "product not found!" });
        }
      })
      .catch((err) => {
        return res.status(500).json({ success: false, error: err });
      });
  });
}

module.exports = router;
