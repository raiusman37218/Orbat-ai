"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetModule = void 0;
const common_1 = require("@nestjs/common");
const widget_controller_1 = require("./widget.controller");
const widget_service_1 = require("./widget.service");
const realtime_module_1 = require("../realtime/realtime.module");
let WidgetModule = class WidgetModule {
};
exports.WidgetModule = WidgetModule;
exports.WidgetModule = WidgetModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => realtime_module_1.RealtimeModule)],
        controllers: [widget_controller_1.WidgetController],
        providers: [widget_service_1.WidgetService],
        exports: [widget_service_1.WidgetService],
    })
], WidgetModule);
//# sourceMappingURL=widget.module.js.map