import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminPageTemplatesService } from './admin-page-templates.service';
import {
  CreateQuestionDto,
  ReorderQuestionsDto,
  UpdateQuestionDto,
} from './dto/question.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Questions')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/magazine-types/:magazineTypeId/questions')
export class AdminPageTemplatesController {
  constructor(private readonly service: AdminPageTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List questions for a magazine type' })
  @ApiParam({ name: 'magazineTypeId' })
  findAll(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findAllByMagazineType(magazineTypeId);
  }

  @Get(':questionId')
  @ApiOperation({ summary: 'Get question by id' })
  findOne(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.service.findOne(magazineTypeId, questionId);
  }

  @Post()
  @ApiOperation({ summary: 'Create question' })
  create(
    @Param('magazineTypeId') magazineTypeId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.service.create(magazineTypeId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder questions' })
  reorder(
    @Param('magazineTypeId') magazineTypeId: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.service.reorder(magazineTypeId, dto);
  }

  @Patch(':questionId')
  @ApiOperation({ summary: 'Update question' })
  update(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.service.update(magazineTypeId, questionId, dto);
  }

  @Delete(':questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete question' })
  remove(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.service.remove(magazineTypeId, questionId);
  }
}
