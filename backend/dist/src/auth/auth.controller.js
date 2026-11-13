"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const signup_dto_1 = require("./dto/signup.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const google_auth_dto_1 = require("./dto/google-auth.dto");
const public_decorator_1 = require("../common/decorators/public.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async signup(dto) {
        return this.authService.signup(dto);
    }
    async login(dto) {
        return this.authService.login(dto);
    }
    async googleAuth(dto) {
        return this.authService.googleAuth(dto);
    }
    getGoogleAuthUrl(redirectUri) {
        return this.authService.getGoogleAuthUrl(redirectUri);
    }
    async refresh(dto) {
        return this.authService.refreshToken(dto);
    }
    async getMe(user) {
        return this.authService.getMe(user.id);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('signup'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new owner account and workspace' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User and workspace successfully created.' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already exists.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [signup_dto_1.SignupDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signup", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Authenticate user with email and password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Authentication successful, JWT tokens returned.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid email or password.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('google'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Authenticate or register user with Google OAuth (code, idToken, or credential)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Google authentication successful, JWT tokens returned.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid Google token or authorization code.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_auth_dto_1.GoogleAuthDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('google/url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Google OAuth login URL' }),
    __param(0, (0, common_1.Query)('redirectUri')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getGoogleAuthUrl", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token using valid refresh token' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token refreshed successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or expired refresh token.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current authenticated user profile and workspace' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User profile retrieved.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized.' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMe", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Authentication'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map