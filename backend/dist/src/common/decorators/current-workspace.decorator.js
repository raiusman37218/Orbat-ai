"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentWorkspace = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentWorkspace = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspaceId || request.user?.workspaceId;
});
//# sourceMappingURL=current-workspace.decorator.js.map