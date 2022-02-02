import {
  Arg,
  Args,
  Ctx,
  Field,
  FieldResolver,
  Info,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import {
  User,
  Company,
  CompanyCreateInput,
  FindManyCompanyArgs,
  Industry,
} from "@generated/type-graphql";
import {
  GraphQLResolveInfo,
} from "graphql";
import {
  Context,
} from "../../types/apollo-context";
import {
  ValidationResponseFor,
} from "../helpers/validation";
import {
  CompanyValidation,
} from "../../services/validation-service";
import {
  CompanyService,
} from "../../services/company-service";
import {
  EventsService,
} from "../../services/events-service";
import {
  hasAtLeastRole,
  Role,
} from "../../helpers/auth";
import {
  toSelect,
  transformSelectFor,
} from "../helpers/resolver";
import {
  transformSelect as transformSelectMembers,
} from "./user";

@Resolver(() => Company)
export class CompanyFieldResolver {
  @FieldResolver((_type) => Industry, { nullable: true })
  industry(
  @Root() company: Company,
  ) {
    return company.industry;
  }

  @FieldResolver((_type) => [ User ], { nullable: true })
  members(
  @Root() company: Company,
  ) {
    return company.members;
  }
}

export const transformSelect = transformSelectFor<CompanyFieldResolver>({
  industry(select) {
    select.industry = {
      select: select.industry,
    };

    return select;
  },

  members(select) {
    select.members = {
      select: transformSelectMembers(select.members as Record<string, unknown>),
    };

    return select;
  },
});

@InputType()
class CreateCompanyInput extends CompanyCreateInput {
  @Field()
    industry: string = "";
}

@ObjectType()
class VatData {
  @Field()
    address: string = "";

  @Field()
    legalName: string = "";
}

@ObjectType()
class ValidateVatResponse {
  @Field()
    valid: boolean = false;

  @Field()
    exists: boolean = false;

  @Field(() => VatData, { nullable: true })
    info: VatData | null = null;
}

@ObjectType()
class CreateCompanyResponse extends ValidationResponseFor(Company) {
}

@Resolver(() => Company)
export class CompanyValidationResolver {
  @Mutation(() => ValidateVatResponse)
  validateVat(
    @Ctx() ctx: Context,
      @Arg("vat") vat: string,
  ): Promise<ValidateVatResponse> {
    return CompanyService.validateVat(vat);
  }
}

@Resolver(() => Company)
export class CompanyInfoMutationsResolver {
  @Mutation(() => CreateCompanyResponse, { nullable: true })
  async registerCompany(
    @Ctx() ctx: Context,
      @Arg("info", () => CreateCompanyInput) info: CreateCompanyInput,
  ): Promise<CreateCompanyResponse | null> {
    if (!ctx.user) {
      return null;
    }

    const validation = await CompanyValidation(info);

    if (!validation.success) {
      return {
        errors: validation.errors,
      };
    }

    const vatValidation = await CompanyService.validateVat(info.vat);

    if (!vatValidation.valid) {
      return {
        errors: [
          {
            field: "vat",
            message: "errors.vat.invalid",
          },
        ],
      };
    }

    if (vatValidation.exists) {
      return {
        errors: [
          {
            field: "vat",
            message: "errors.vat.already-exists",
          },
        ],
      };
    }

    const industry = await ctx.prisma.industry.findFirst({
      where: {
        name: info.industry,
      },
    });

    if (!industry) {
      return {
        errors: [
          {
            field: "industry",
            message: "Industry does not exist",
          },
        ],
      };
    }

    const entity = await ctx.prisma.company.create({
      data: {
        ...info,
        industry: {
          connect: {
            id: industry.id,
          },
        },
        members: {
          connect: {
            id: ctx.user.id,
          },
        },
      },
    });

    void EventsService.logEvent("company:register", ctx.user.id, { vat: entity.vat });

    return {
      entity,
    };
  }

  @Mutation(() => CreateCompanyResponse, { nullable: true })
  async updateCompanyInfo(
    @Ctx() ctx: Context,
      @Arg("info", () => CreateCompanyInput) info: CreateCompanyInput,
  ): Promise<CreateCompanyResponse | null> {
    if (!ctx.user) {
      return null;
    }

    const validation = await CompanyValidation(info);

    if (!validation.success) {
      return {
        errors: validation.errors,
      };
    }

    const isInCompany = ctx.user.companies.some((company) => company.vat === info.vat);

    if (!isInCompany && !hasAtLeastRole(Role.Admin, ctx.user)) {
      return {
        errors: [
          {
            field: "vat",
            message: "You can not edit the company",
          },
        ],
      };
    }

    const industry = await ctx.prisma.industry.findFirst({
      where: {
        name: info.industry,
      },
    });

    if (!industry) {
      return {
        errors: [
          {
            field: "industry",
            message: "Industry does not exist",
          },
        ],
      };
    }

    const create = await ctx.prisma.company.update({
      data: {
        ...info,
        industry: {
          connect: {
            id: industry.id,
          },
        },
      },
      where: {
        vat: info.vat,
      },
      include: {
        industry: true,
      },
    });

    void EventsService.logEvent("company:update", ctx.user.id, { vat: create.vat });

    return {
      entity: create,
    };
  }
}

@Resolver(() => Company)
export class CompanyListResolver {
  @Query(() => [ Company ])
  companies(
  @Ctx() ctx: Context,
    @Info() info: GraphQLResolveInfo,
    @Args() args: FindManyCompanyArgs,
  ) {
    if (!ctx.user) {
      return [];
    }

    return ctx.prisma.company.findMany({
      ...args,
      select: toSelect(info, transformSelect),
    });
  }

  @Query(() => Company, { nullable: true })
  company(
  @Ctx() ctx: Context,
    @Info() info: GraphQLResolveInfo,
    @Arg("vat") vat: string,
  ) {
    if (!ctx.user) {
      return null;
    }

    if (
      !ctx.user.companies.some((company) => company.vat === vat) &&
      !hasAtLeastRole(Role.Admin, ctx.user)
    ) {
      return null;
    }

    return ctx.prisma.company.findUnique({
      where: {
        vat,
      },

      select: toSelect(info, transformSelect),
    });
  }
}
