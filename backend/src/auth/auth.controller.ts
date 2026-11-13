import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/tenant-context';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new owner account and workspace' })
  @ApiResponse({ status: 201, description: 'User and workspace successfully created.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful, JWT tokens returned.' })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate or register user with Google OAuth (code, idToken, or credential)' })
  @ApiResponse({ status: 200, description: 'Google authentication successful, JWT tokens returned.' })
  @ApiResponse({ status: 401, description: 'Invalid Google token or authorization code.' })
  async googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  @Public()
  @Get('google/url')
  @ApiOperation({ summary: 'Get Google OAuth login URL' })
  getGoogleAuthUrl(@Query('redirectUri') redirectUri?: string) {
    return this.authService.getGoogleAuthUrl(redirectUri);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using valid refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile and workspace' })
  @ApiResponse({ status: 200, description: 'User profile retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
