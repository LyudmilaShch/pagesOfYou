import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CatalogQuestionsService } from '../services/questions.service';

@ApiTags('Catalog — Questions')
@UseGuards(JwtAuthGuard)
@Controller('catalog/magazine-types/by-id')
export class CatalogQuestionsController {
  constructor(private readonly service: CatalogQuestionsService) {}

  @Public()
  @Get(':magazineTypeId/questions')
  @ApiOperation({
    summary: 'Get questions for a magazine type — used to build the questionnaire',
  })
  findByMagazineType(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findByMagazineTypeId(magazineTypeId);
  }
}
