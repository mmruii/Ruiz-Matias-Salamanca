import orderService from "../services/OrderService.js";
import { sendSuccess } from "../responses/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

class OrderController {
  getAll = asyncHandler((req, res) => sendSuccess(res, orderService.getAll()));
  create = asyncHandler((req, res) => sendSuccess(res, orderService.create(req.body), 201));
}

export default new OrderController();
