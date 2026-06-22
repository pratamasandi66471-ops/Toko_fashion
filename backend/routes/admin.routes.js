const express = require("express");

const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const adminAuditController = require("../controllers/adminAudit.controller");
const adminController = require("../controllers/admin.controller");
const adminCategoryController = require("../controllers/adminCategory.controller");
const adminCustomerController = require("../controllers/adminCustomer.controller");
const adminInventoryController = require("../controllers/adminInventory.controller");
const adminMarketingContentController = require("../controllers/adminMarketingContent.controller");
const adminNotificationController = require("../controllers/adminNotification.controller");
const adminOrderController = require("../controllers/adminOrder.controller");
const adminPaymentController = require("../controllers/adminPayment.controller");
const adminProfileController = require("../controllers/adminProfile.controller");
const adminProductController = require("../controllers/adminProduct.controller");
const adminReportController = require("../controllers/adminReport.controller");
const adminReturnController = require("../controllers/adminReturn.controller");
const adminReviewController = require("../controllers/adminReview.controller");
const adminSettingsController = require("../controllers/adminSettings.controller");
const adminShippingController = require("../controllers/adminShipping.controller");
const adminStaffController = require("../controllers/adminStaff.controller");
const adminVoucherController = require("../controllers/adminVoucher.controller");
const { uploadProductImage } = require("../middleware/upload.middleware");

const router = express.Router();

function uploadSingleProductImage(req, res, next) {
  uploadProductImage.single("image")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      req.flash("error", "Ukuran gambar maksimal 2MB.");
    } else if (error.code === "INVALID_PRODUCT_IMAGE_TYPE") {
      req.flash("error", "Format gambar harus JPG, PNG, atau WEBP.");
    } else {
      req.flash("error", "Upload gambar gagal. Silakan coba lagi.");
    }

    return res.redirect(`/admin/products/${req.params.id}/edit`);
  });
}

router.use(requireAuth);
router.use(requireRole("admin"));

// Dashboard
router.get("/dashboard", adminController.showDashboard);
router.get("/dashboard/data", adminController.getDashboardData);

// Core management
router.get("/orders", adminOrderController.index);
router.get("/orders/:id", adminOrderController.show);
router.post("/orders/:id/status", adminOrderController.updateStatus);
router.post("/orders/:id/tracking", adminOrderController.updateTracking);
router.post("/orders/:id/cancel", adminOrderController.cancel);
router.get("/products", adminProductController.index);
router.get("/products/create", adminProductController.showCreate);
router.post("/products", adminProductController.create);
router.get("/products/:id/edit", adminProductController.showEdit);
router.post("/products/:id/update", adminProductController.update);
router.post("/products/:id/toggle-status", adminProductController.toggleStatus);
router.post("/products/:id/variants", adminProductController.addVariant);
router.post("/products/variants/:variantId/update", adminProductController.updateVariant);
router.post("/products/variants/:variantId/delete", adminProductController.deleteVariant);
router.post("/products/:id/images", uploadSingleProductImage, adminProductController.addImage);
router.post("/products/images/:imageId/delete", adminProductController.deleteImage);
router.post("/products/images/:imageId/set-primary", adminProductController.setPrimaryImage);

router.get("/categories", adminCategoryController.index);
router.get("/categories/create", adminCategoryController.showCreate);
router.post("/categories", adminCategoryController.create);
router.get("/categories/:id/edit", adminCategoryController.showEdit);
router.post("/categories/:id/update", adminCategoryController.update);
router.post("/categories/:id/toggle-status", adminCategoryController.toggleStatus);
router.get("/inventory", adminInventoryController.index);
router.post("/inventory/:variantId/update-stock", adminInventoryController.updateStock);
router.post("/inventory/:variantId/toggle-status", adminInventoryController.toggleStatus);
router.get("/customers", adminCustomerController.index);
router.get("/customers/:id", adminCustomerController.show);
router.post("/customers/:id/status", adminCustomerController.updateStatus);
router.get("/staff", adminStaffController.index);
router.get("/staff/create", adminStaffController.showCreate);
router.post("/staff", adminStaffController.create);
router.get("/staff/:id/edit", adminStaffController.showEdit);
router.post("/staff/:id/update", adminStaffController.update);
router.post("/staff/:id/status", adminStaffController.updateStatus);

// Commerce
router.get("/payments", adminPaymentController.index);
router.get("/payments/:id", adminPaymentController.show);
router.post("/payments/:id/verify", adminPaymentController.verify);
router.post("/payments/:id/reject", adminPaymentController.reject);
router.get("/shipping", adminShippingController.index);
router.get("/shipping/create", adminShippingController.showCreate);
router.post("/shipping", adminShippingController.create);
router.get("/shipping/:id/edit", adminShippingController.showEdit);
router.post("/shipping/:id/update", adminShippingController.update);
router.post("/shipping/:id/toggle-status", adminShippingController.toggleStatus);
router.get("/returns", adminReturnController.index);
router.get("/returns/create", adminReturnController.showCreate);
router.post("/returns", adminReturnController.create);
router.get("/returns/:id", adminReturnController.show);
router.post("/returns/:id/status", adminReturnController.updateStatus);
router.post("/returns/:id/note", adminReturnController.updateNote);

// Growth placeholder
router.get("/reviews", adminReviewController.index);
router.get("/reviews/:id", adminReviewController.show);
router.post("/reviews/:id/delete", adminReviewController.delete);
router.get("/promotions", adminMarketingContentController.promotionsIndex);
router.get("/promotions/create", adminMarketingContentController.promotionsCreate);
router.post("/promotions", adminMarketingContentController.promotionsStore);
router.get("/promotions/:id/edit", adminMarketingContentController.promotionsEdit);
router.post("/promotions/:id/update", adminMarketingContentController.promotionsUpdate);
router.post("/promotions/:id/toggle-status", adminMarketingContentController.promotionsToggleStatus);
router.get("/vouchers", (req, res) => res.redirect("/admin/coupons"));
router.get("/coupons", adminVoucherController.index);
router.get("/coupons/create", adminVoucherController.showCreate);
router.post("/coupons", adminVoucherController.create);
router.get("/coupons/:id/edit", adminVoucherController.showEdit);
router.post("/coupons/:id/update", adminVoucherController.update);
router.post("/coupons/:id/toggle-status", adminVoucherController.toggleStatus);
router.get("/content", adminMarketingContentController.contentIndex);
router.get("/content/create", adminMarketingContentController.contentCreate);
router.post("/content", adminMarketingContentController.contentStore);
router.get("/content/:id/edit", adminMarketingContentController.contentEdit);
router.post("/content/:id/update", adminMarketingContentController.contentUpdate);
router.post("/content/:id/toggle-status", adminMarketingContentController.contentToggleStatus);

// System placeholder
router.get("/reports", adminReportController.index);
router.get("/audit-logs", adminAuditController.index);
router.get("/notifications", adminNotificationController.index);
router.get("/notifications/create", adminNotificationController.showCreate);
router.post("/notifications", adminNotificationController.create);
router.get("/notifications/:id/edit", adminNotificationController.showEdit);
router.post("/notifications/:id/update", adminNotificationController.update);
router.post("/notifications/:id/publish", adminNotificationController.publish);
router.post("/notifications/:id/archive", adminNotificationController.archive);
router.get("/settings", adminSettingsController.showSettings);
router.post("/settings", adminSettingsController.updateSettings);

router.get("/profile", adminProfileController.showProfile);
router.post("/profile", adminProfileController.updateProfile);
router.post("/profile/password", adminProfileController.updatePassword);

module.exports = router;
