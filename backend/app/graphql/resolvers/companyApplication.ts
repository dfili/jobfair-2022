import {
  Arg,
  Args,
  Authorized,
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
  ApplicationCocktail,
  ApplicationPresenter,
  ApplicationTalk,
  ApplicationWorkshop,
  Company,
  CompanyApplication,
  CompanyApplicationApproval,
  FindManyCompanyApplicationArgs,
  Season,
} from "@generated/type-graphql";
import {
  omit,
} from "rambdax";
import {
  GraphQLResolveInfo,
} from "graphql";
import type {
  Prisma,
} from "@prisma/client";
import {
  upperFirst,
} from "lodash";
import {
  FileUpload,
} from "graphql-upload";
import {
  Context,
} from "../../types/apollo-context";
import {
  FieldError,
  ValidationResponseFor,
} from "../helpers/validation";
import {
  toSelect,
  transformSelectFor,
} from "../helpers/resolver";
import {
  CompanyApplicationApprovedValidation,
  CompanyApplicationValidation,
} from "../../services/validation-service";
import {
  hasAtLeastRole,
  Role,
} from "../../helpers/auth";
import SlackNotificationService from "../../services/slack-notification-service";
import {
  BoothsService,
} from "../../services/booths-service";
import {
  EventsService,
} from "../../services/events-service";
import {
  ImageBase,
  ImageService,
} from "../../services/image-service";
import {
  Dict,
} from "../../types/helpers";
import {
  TalkCreateInput,
  TalksCreateInput,
  transformSelect as transformSelectTalks,
} from "./companyApplicationTalk";
import {
  transformSelect as transformSelectWorkshops,
  WorkshopCreateInput,
  WorkshopsCreateInput,
} from "./companyApplicationWorkshop";
import {
  transformSelect as transformSelectCompany,
} from "./company";
import {
  transformSelect as transformSelectSeason,
} from "./season";
import {
  transformSelect as transformSelectApproval,
} from "./companyApplicationApproval";
import {
  CocktailCreateInput,
  transformSelect as transformSelectCocktail,
} from "./companyApplicationCocktail";
import {
  PresenterCreateInput,
  transformSelect as transformSelectPresenter,
} from "./companyPresenter";

const photoMimeTypes = new Set([
  "image/png",
  "image/jpeg",
]);

const photoExtensions = [
  ".jpeg",
  ".jpg",
  ".png",
];

@Resolver(() => CompanyApplication)
export class CompanyApplicationFieldResolver {
  @FieldResolver(() => ApplicationTalk, { nullable: true })
  talk(
    @Root() application: CompanyApplication,
  ): ApplicationTalk | null {
    return application.talk || null;
  }

  @FieldResolver(() => ApplicationWorkshop, { nullable: true })
  workshop(
    @Root() application: CompanyApplication,
  ): ApplicationWorkshop | null {
    return application.workshop || null;
  }

  @FieldResolver(() => Company, { nullable: true })
  forCompany(
    @Root() application: CompanyApplication,
  ): Company {
    return application.forCompany!;
  }

  @FieldResolver(() => Season, { nullable: true })
  forSeason(
    @Root() application: CompanyApplication,
  ): Season {
    return application.forSeason!;
  }

  @FieldResolver(() => CompanyApplicationApproval, { nullable: true })
  approval(
    @Root() application: CompanyApplication,
  ): CompanyApplicationApproval | null {
    return application.approval || null;
  }

  @FieldResolver(() => ApplicationCocktail, { nullable: true })
  cocktail(
    @Root() application: CompanyApplication,
  ): ApplicationCocktail | null {
    return application.cocktail || null;
  }

  @FieldResolver(() => [ ApplicationPresenter ])
  panelParticipants(
    @Root() application: CompanyApplication,
  ): ApplicationPresenter[] {
    return application.panelParticipants || [];
  }
}

export const transformSelect = transformSelectFor<CompanyApplicationFieldResolver>({
  talk(select) {
    select.talk = {
      select: transformSelectTalks(select.talk as Record<string, unknown>),
    };

    return select;
  },

  workshop(select) {
    select.workshop = {
      select: transformSelectWorkshops(select.workshop as Record<string, unknown>),
    };

    return select;
  },

  forCompany(select) {
    select.forCompany = {
      select: transformSelectCompany(select.forCompany as Record<string, unknown>),
    };

    return select;
  },

  forSeason(select) {
    select.forSeason = {
      select: transformSelectSeason(select.forSeason as Record<string, unknown>),
    };

    return select;
  },

  approval(select) {
    select.approval = {
      select: transformSelectApproval(select.approval as Dict),
    };

    return select;
  },

  cocktail(select) {
    select.cocktail = {
      select: transformSelectCocktail(select.cocktail as Dict),
    };

    return select;
  },

  panelParticipants(select) {
    select.panelParticipants = {
      select: transformSelectPresenter(select.panelParticipants as Dict),
    };

    return select;
  },
});

@InputType()
class CompanyApplicationCreateInput {
  @Field()
    vat: string = "";

  @Field(() => String, { nullable: true })
    booth: string | null = null;

  @Field(() => TalkCreateInput, { nullable: true })
    talk: TalkCreateInput | null = null;

  @Field(() => WorkshopCreateInput, { nullable: true })
    workshop: WorkshopCreateInput | null = null;

  @Field(() => Boolean)
    wantsCocktail: boolean = false;

  @Field(() => Boolean)
    wantsPanel: boolean = false;
}

@InputType()
class CompanyApplicationApprovedEditInput {
  @Field()
    vat: string = "";

  @Field(() => TalksCreateInput, { nullable: true })
    talk: TalksCreateInput | null = null;

  @Field(() => WorkshopsCreateInput, { nullable: true })
    workshop: WorkshopsCreateInput | null = null;

  @Field(() => CocktailCreateInput, { nullable: true })
    cocktail: CocktailCreateInput | null = null;

  @Field(() => [ PresenterCreateInput ])
    panel: PresenterCreateInput[] = [];
}

@ObjectType()
class CreateCompanyApplicationResponse extends ValidationResponseFor(CompanyApplication) {
}

@ObjectType()
class EditApprovedCompanyApplicationResponse extends ValidationResponseFor(CompanyApplication) {
}

@Resolver(() => CompanyApplication)
export class CompanyApplicationInfoResolver {
  @Query(() => CompanyApplication, { nullable: true })
  async companyApplication(
  @Ctx() ctx: Context,
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!ctx.user) {
      return null;
    }

    if (1 > ctx.user.companies.length) {
      return null;
    }

    const [ company ] = ctx.user.companies;

    const currentSeason = await ctx.prisma.season.findFirst({
      where: {
        startsAt: {
          lte: new Date(),
        },
        endsAt: {
          gte: new Date(),
        },
      },
      select: {
        id: true,
      },
    });

    if (!currentSeason) {
      return null;
    }

    return ctx.prisma.companyApplication.findUnique({
      where: {
        // eslint-disable-next-line camelcase
        forCompanyId_forSeasonId: {
          forCompanyId: company.id,
          forSeasonId: currentSeason.id,
        },
      },
      select: toSelect(info, transformSelect),
    });
  }
}


@Resolver(() => CompanyApplication)
export class CompanyApplicationAdminResolver {
  @Query(() => [ CompanyApplication ], { nullable: true })
  companyApplications(
  @Ctx() ctx: Context,
    @Arg("season", { nullable: true }) seasonUid: string,
    @Args() args: FindManyCompanyApplicationArgs,
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!hasAtLeastRole(Role.Admin, ctx.user)) {
      return null;
    }

    const now = new Date();

    return ctx.prisma.companyApplication.findMany({
      ...args,
      where: {
        forSeason:
          seasonUid
            ? {
              uid: seasonUid,
            }
            : {
              startsAt: {
                lte: now,
              },
              endsAt: {
                gte: now,
              },
            },
        ...args.where,
      },
      select: toSelect(info, transformSelect),
    });
  }

  @Query(() => CompanyApplication, { nullable: true })
  companyApplicationFor(
  @Ctx() ctx: Context,
    @Arg("company") companyUid: string,
    @Arg("season") seasonUid: string,
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!hasAtLeastRole(Role.Admin, ctx.user)) {
      return null;
    }

    return ctx.prisma.companyApplication.findFirst({
      where: {
        forSeason: {
          uid: seasonUid,
        },
        forCompany: {
          uid: companyUid,
        },
      },
      select: toSelect(info, transformSelect),
    });
  }

  @Mutation(() => CreateCompanyApplicationResponse, { nullable: true })
  async createCompanyApplicationFor(
    @Ctx() ctx: Context,
      @Arg("season") seasonUid: string,
      @Arg("company") companyUid: string,
      @Arg("info") info: CompanyApplicationCreateInput,
  ): Promise<CreateCompanyApplicationResponse | null> {
    if (!hasAtLeastRole(Role.Admin, ctx.user)) {
      return null;
    }

    const validation = await CompanyApplicationValidation(info);

    if (!validation.success) {
      return {
        errors: validation.errors,
      };
    }

    const booths = await BoothsService.fetchBooths();

    if (!booths.some((booth) => info.booth === booth.key)) {
      return {
        errors: [
          {
            field: "booth",
            message: "Unknown booth",
          },
        ],
      };
    }

    const company = await ctx.prisma.company.findUnique({
      where: {
        uid: companyUid,
      },
    });

    if (!company) {
      return {
        errors: [
          {
            field: "entity",
            message: "Company does not exist",
          },
        ],
      };
    }

    const currentSeason = await ctx.prisma.season.findFirst({
      where: {
        uid: seasonUid,
      },
      select: {
        id: true,
      },
    });

    if (!currentSeason) {
      return {
        errors: [
          {
            field: "entity",
            message: "Season is closed",
          },
        ],
      };
    }

    const entity = await ctx.prisma.$transaction(async (prisma) => {
      const oldApplication = await prisma.companyApplication.findUnique({
        where: {
          // eslint-disable-next-line camelcase
          forCompanyId_forSeasonId: {
            forCompanyId: company.id,
            forSeasonId: currentSeason.id,
          },
        },
        select: {
          id: true,

          talk: {
            select: {
              id: true,
              presenters: {
                select: {
                  id: true,
                  photo: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },

          workshop: {
            select: {
              id: true,
              presenters: {
                select: {
                  id: true,
                  photo: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let talkPresenter;
      if (info.talk) {
        talkPresenter = {
          ...info.talk.presenter,
          photo: {
            connect: {
              id: 0,
            },
          },
        };

        const photoFile = await info.talk.presenter.photo;

        if (photoFile) {
          if (
            !photoMimeTypes.has(photoFile?.mimetype)
            || !photoExtensions.some((ext) => photoFile.filename.endsWith(ext))
          ) {
            return {
              errors: [
                {
                  field: "talk.presenter.photo",
                  message: `File must have extension: ${ photoExtensions.join(", ") }`,
                },
              ],
            };
          }

          const photo = await ImageService.uploadImage(
            `company/${ info.vat }/talk/presenters` as ImageBase,
            photoFile,
            ctx.user!,
          );

          if (!photo) {
            return {
              errors: [
                {
                  field: "talk.presenter.photo",
                  message: "Something went wrong",
                },
              ],
            };
          }

          talkPresenter.photo.connect.id = photo.id;
        } else if (oldApplication?.talk?.presenters[0].photo) {
          talkPresenter.photo.connect.id = oldApplication.talk.presenters[0].photo.id;
        } else {
          return {
            errors: [
              {
                field: "talk.presenter.photo",
                message: "Photo is required",
              },
            ],
          };
        }
      }

      let workshopPresenter;
      if (info.workshop) {
        workshopPresenter = {
          ...info.workshop.presenter,
          photo: {
            connect: {
              id: 0,
            },
          },
        };

        const photoFile = await info.workshop.presenter.photo;

        if (photoFile) {
          if (
            !photoMimeTypes.has(photoFile?.mimetype)
            || !photoExtensions.some((ext) => photoFile.filename.endsWith(ext))
          ) {
            return {
              errors: [
                {
                  field: "workshop.presenter.photo",
                  message: `File must have extension: ${ photoExtensions.join(", ") }`,
                },
              ],
            };
          }

          const photo = await ImageService.uploadImage(
            `company/${ info.vat }/workshop/presenters` as ImageBase,
            photoFile,
            ctx.user!,
          );

          if (!photo) {
            return {
              errors: [
                {
                  field: "workshop.presenter.photo",
                  message: "Something went wrong",
                },
              ],
            };
          }

          workshopPresenter.photo.connect.id = photo.id;
        } else if (oldApplication?.workshop?.presenters[0].photo) {
          workshopPresenter.photo.connect.id = oldApplication.workshop.presenters[0].photo.id;
        } else {
          return {
            errors: [
              {
                field: "workshop.presenter.photo",
                message: "Photo is required",
              },
            ],
          };
        }
      }

      const chosen = {
        booth: booths.find((booth) => booth.key === info.booth)?.name,
        workshop: Boolean(info.workshop),
        talk: Boolean(info.talk),
        cocktail: info.wantsCocktail,
        panel: info.wantsPanel,
      } as const;

      if (!oldApplication) {
        const entity = await prisma.companyApplication.create({
          data: {
            booth: info.booth,
            wantsPanel: info.wantsPanel,
            wantsCocktail: info.wantsCocktail,
            talk: {
              create:
                info.talk
                  ? {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.talk,
                    ),
                    category: {
                      connect: {
                        name: info.talk.category,
                      },
                    },
                    presenters: {
                      create: {
                        ...talkPresenter as NonNullable<typeof talkPresenter>,
                      },
                    },
                  }
                  : undefined
              ,
            },
            workshop: {
              create:
                info.workshop
                  ? {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.workshop,
                    ),
                    presenters: {
                      create: {
                        ...workshopPresenter as NonNullable<typeof workshopPresenter>,
                      },
                    },
                  }
                  : undefined
              ,
            },
            forCompany: {
              connect: {
                vat: info.vat,
              },
            },
            forSeason: {
              connect: {
                id: currentSeason.id,
              },
            },
          },
          include: {
            workshop: {
              include: {
                presenters: {
                  include: {
                    photo: true,
                  },
                },
              },
            },
            talk: {
              include: {
                presenters: {
                  include: {
                    photo: true,
                  },
                },
                category: true,
              },
            },
          },
        });

        if (entity) {
          void EventsService.logEvent(
            "admin:company-application:create",
            ctx.user!.id,
            {
              vat: company.vat,
              chosen,
            },
          );
        }

        return entity;
      }

      const deleteIf =
        (cond: unknown) =>
          cond
            ? {
              delete: true,
            }
            : undefined
      ;

      const entity = await prisma.companyApplication.update({
        where: {
          // eslint-disable-next-line camelcase
          forCompanyId_forSeasonId: {
            forCompanyId: company.id,
            forSeasonId: currentSeason.id,
          },
        },

        data: {
          booth: info.booth,
          wantsPanel: info.wantsPanel,
          wantsCocktail: info.wantsCocktail,
          talk:
            info.talk
              ? {
                upsert: {
                  create: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.talk,
                    ),
                    category: {
                      connect: {
                        name: info.talk.category,
                      },
                    },
                    presenters: {
                      create: {
                        ...talkPresenter as NonNullable<typeof talkPresenter>,
                      },
                    },
                  },
                  update: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.talk,
                    ),
                    category: {
                      connect: {
                        name: info.talk.category,
                      },
                    },
                    presenters: {
                      deleteMany: oldApplication.talk
                        ? {
                          id: {
                            in: oldApplication.talk?.presenters.map((x) => x.id),
                          },
                        }
                        : undefined,
                      create: {
                        ...talkPresenter as NonNullable<typeof talkPresenter>,
                      },
                    },
                  },
                },
              }
              : deleteIf(oldApplication.talk),
          workshop:
            info.workshop
              ? {
                upsert: {
                  create: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.workshop,
                    ),
                    presenters: {
                      create: {
                        ...workshopPresenter as NonNullable<typeof workshopPresenter>,
                      },
                    },
                  },
                  update: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.workshop,
                    ),
                    presenters: {
                      deleteMany: oldApplication.workshop
                        ? {
                          id: {
                            in: oldApplication.workshop?.presenters.map((x) => x.id),
                          },
                        }
                        : undefined,
                      create: {
                        ...workshopPresenter as NonNullable<typeof workshopPresenter>,
                      },
                    },
                  },
                },
              }
              : deleteIf(oldApplication.workshop),
          forCompany: {
            connect: {
              vat: info.vat,
            },
          },
          forSeason: {
            connect: {
              id: currentSeason.id,
            },
          },
        },

        include: {
          workshop: {
            include: {
              presenters: {
                include: {
                  photo: true,
                },
              },
            },
          },
          talk: {
            include: {
              presenters: {
                include: {
                  photo: true,
                },
              },
              category: true,
            },
          },
        },
      });

      if (entity) {
        void EventsService.logEvent(
          "admin:company-application:update",
          ctx.user!.id,
          {
            vat: company.vat,
            chosen,
          },
        );
      }

      return entity;
    }).catch((err) => {
      console.log(err);

      return {
        errors: [
          {
            field: "entity",
            message: "Something went wrong",
          },
        ],
      };
    });

    const errors = (entity as Record<string, unknown>).errors as FieldError[] | undefined;

    if (errors) {
      return {
        errors,
      };
    }

    return {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      entity,
    };
  }
}


@Resolver(() => CompanyApplication)
export class CompanyApplicationCreateResolver {
  @Mutation(() => CreateCompanyApplicationResponse, { nullable: true })
  async createCompanyApplication(
    @Ctx() ctx: Context,
      @Arg("info") info: CompanyApplicationCreateInput,
  ): Promise<CreateCompanyApplicationResponse | null> {
    if (!ctx.user) {
      return null;
    }

    const validation = await CompanyApplicationValidation(info);

    if (!validation.success) {
      return {
        errors: validation.errors,
      };
    }

    const canPickPanelOrCocktail = Boolean(info.talk || info.workshop || info.booth);

    if (!canPickPanelOrCocktail && (info.wantsCocktail || info.wantsPanel)) {
      return {
        errors: [
          {
            field: "entity",
            message: "You may not pick only cocktail and/or panel",
          },
        ],
      };
    }

    const booths = await BoothsService.fetchBooths();

    if (!booths.some((booth) => info.booth === booth.key)) {
      return {
        errors: [
          {
            field: "booth",
            message: "Unknown booth",
          },
        ],
      };
    }

    info.vat = info.vat.toUpperCase();

    const isInCompany = ctx.user.companies.some((company) => company.vat === info.vat);

    if (!isInCompany && !hasAtLeastRole(Role.Admin, ctx.user)) {
      return {
        errors: [
          {
            field: "entity",
            message: "You can not edit the company",
          },
        ],
      };
    }

    const company = await ctx.prisma.company.findUnique({
      where: {
        vat: info.vat,
      },
    });

    if (!company) {
      return {
        errors: [
          {
            field: "entity",
            message: "Company does not exist",
          },
        ],
      };
    }

    const currentSeason = await ctx.prisma.season.findFirst({
      where: {
        startsAt: {
          lte: new Date(),
        },
        endsAt: {
          gte: new Date(),
        },
      },
      select: {
        id: true,
        applicationsFrom: true,
        applicationsUntil: true,
      },
    });

    if (!currentSeason) {
      return {
        errors: [
          {
            field: "entity",
            message: "Season is closed",
          },
        ],
      };
    }

    {
      const now = new Date();
      const from = new Date(currentSeason.applicationsFrom);
      const until = new Date(currentSeason.applicationsUntil);
      const applicationsOpen = from < now && now < until;

      if (!applicationsOpen) {
        return {
          errors: [
            {
              field: "entity",
              message: "Applications closed",
            },
          ],
        };
      }
    }

    const entity = await ctx.prisma.$transaction(async (prisma) => {
      const oldApplication = await prisma.companyApplication.findUnique({
        where: {
          // eslint-disable-next-line camelcase
          forCompanyId_forSeasonId: {
            forCompanyId: company.id,
            forSeasonId: currentSeason.id,
          },
        },
        select: {
          id: true,

          talk: {
            select: {
              id: true,
              presenters: {
                select: {
                  id: true,
                  photo: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },

          workshop: {
            select: {
              id: true,
              presenters: {
                select: {
                  id: true,
                  photo: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let talkPresenter;
      if (info.talk) {
        talkPresenter = {
          ...info.talk.presenter,
          photo: {
            connect: {
              id: 0,
            },
          },
        };

        const photoFile = await info.talk.presenter.photo;

        if (photoFile) {
          if (
            !photoMimeTypes.has(photoFile?.mimetype)
            || !photoExtensions.some((ext) => photoFile.filename.endsWith(ext))
          ) {
            return {
              errors: [
                {
                  field: "talk.presenter.photo",
                  message: `File must have extension: ${ photoExtensions.join(", ") }`,
                },
              ],
            };
          }

          const photo = await ImageService.uploadImage(
            `company/${ info.vat }/talk/presenters` as ImageBase,
            photoFile,
            ctx.user!,
          );

          if (!photo) {
            return {
              errors: [
                {
                  field: "talk.presenter.photo",
                  message: "Something went wrong",
                },
              ],
            };
          }

          talkPresenter.photo.connect.id = photo.id;
        } else if (oldApplication?.talk?.presenters[0].photo) {
          talkPresenter.photo.connect.id = oldApplication.talk.presenters[0].photo.id;
        } else {
          return {
            errors: [
              {
                field: "talk.presenter.photo",
                message: "Photo is required",
              },
            ],
          };
        }
      }

      let workshopPresenter;
      if (info.workshop) {
        workshopPresenter = {
          ...info.workshop.presenter,
          photo: {
            connect: {
              id: 0,
            },
          },
        };

        const photoFile = await info.workshop.presenter.photo;

        if (photoFile) {
          if (
            !photoMimeTypes.has(photoFile?.mimetype)
            || !photoExtensions.some((ext) => photoFile.filename.endsWith(ext))
          ) {
            return {
              errors: [
                {
                  field: "workshop.presenter.photo",
                  message: `File must have extension: ${ photoExtensions.join(", ") }`,
                },
              ],
            };
          }

          const photo = await ImageService.uploadImage(
            `company/${ info.vat }/workshop/presenters` as ImageBase,
            photoFile,
            ctx.user!,
          );

          if (!photo) {
            return {
              errors: [
                {
                  field: "workshop.presenter.photo",
                  message: "Something went wrong",
                },
              ],
            };
          }

          workshopPresenter.photo.connect.id = photo.id;
        } else if (oldApplication?.workshop?.presenters[0].photo) {
          workshopPresenter.photo.connect.id = oldApplication.workshop.presenters[0].photo.id;
        } else {
          return {
            errors: [
              {
                field: "workshop.presenter.photo",
                message: "Photo is required",
              },
            ],
          };
        }
      }

      const chosen = {
        booth: booths.find((booth) => booth.key === info.booth)?.name,
        workshop: Boolean(info.workshop),
        talk: Boolean(info.talk),
        cocktail: info.wantsCocktail,
        panel: info.wantsPanel,
      } as const;

      if (!oldApplication) {
        const entity = await prisma.companyApplication.create({
          data: {
            booth: info.booth,
            wantsPanel: info.wantsPanel,
            wantsCocktail: info.wantsCocktail,
            talk: {
              create:
                info.talk
                  ? {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.talk,
                    ),
                    category: {
                      connect: {
                        name: info.talk.category,
                      },
                    },
                    presenters: {
                      create: {
                        ...talkPresenter as NonNullable<typeof talkPresenter>,
                      },
                    },
                  }
                  : undefined
              ,
            },
            workshop: {
              create:
                info.workshop
                  ? {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.workshop,
                    ),
                    presenters: {
                      create: {
                        ...workshopPresenter as NonNullable<typeof workshopPresenter>,
                      },
                    },
                  }
                  : undefined
              ,
            },
            forCompany: {
              connect: {
                vat: info.vat,
              },
            },
            forSeason: {
              connect: {
                id: currentSeason.id,
              },
            },
          },
          include: {
            workshop: {
              include: {
                presenters: {
                  include: {
                    photo: true,
                  },
                },
              },
            },
            talk: {
              include: {
                presenters: {
                  include: {
                    photo: true,
                  },
                },
                category: true,
              },
            },
          },
        });

        if (entity) {
          void SlackNotificationService.notifyOfNewApplication(
            company,
            ctx.user!,
            chosen,
          );

          void EventsService.logEvent(
            "company-application:create",
            ctx.user!.id,
            {
              vat: company.vat,
              chosen,
            },
          );
        }

        return entity;
      }

      const deleteIf =
        (cond: unknown) =>
          cond
            ? {
              delete: true,
            }
            : undefined
      ;

      const entity = await prisma.companyApplication.update({
        where: {
          // eslint-disable-next-line camelcase
          forCompanyId_forSeasonId: {
            forCompanyId: company.id,
            forSeasonId: currentSeason.id,
          },
        },

        data: {
          booth: info.booth,
          wantsPanel: info.wantsPanel,
          wantsCocktail: info.wantsCocktail,
          talk:
            info.talk
              ? {
                upsert: {
                  create: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.talk,
                    ),
                    category: {
                      connect: {
                        name: info.talk.category,
                      },
                    },
                    presenters: {
                      create: {
                        ...talkPresenter as NonNullable<typeof talkPresenter>,
                      },
                    },
                  },
                  update: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.talk,
                    ),
                    category: {
                      connect: {
                        name: info.talk.category,
                      },
                    },
                    presenters: {
                      deleteMany: oldApplication.talk
                        ? {
                          id: {
                            in: oldApplication.talk?.presenters.map((x) => x.id),
                          },
                        }
                        : undefined,
                      create: {
                        ...talkPresenter as NonNullable<typeof talkPresenter>,
                      },
                    },
                  },
                },
              }
              : deleteIf(oldApplication.talk),
          workshop:
            info.workshop
              ? {
                upsert: {
                  create: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.workshop,
                    ),
                    presenters: {
                      create: {
                        ...workshopPresenter as NonNullable<typeof workshopPresenter>,
                      },
                    },
                  },
                  update: {
                    ...omit(
                      [
                        "presenter",
                      ],
                      info.workshop,
                    ),
                    presenters: {
                      deleteMany: oldApplication.workshop
                        ? {
                          id: {
                            in: oldApplication.workshop?.presenters.map((x) => x.id),
                          },
                        }
                        : undefined,
                      create: {
                        ...workshopPresenter as NonNullable<typeof workshopPresenter>,
                      },
                    },
                  },
                },
              }
              : deleteIf(oldApplication.workshop),
          forCompany: {
            connect: {
              vat: info.vat,
            },
          },
          forSeason: {
            connect: {
              id: currentSeason.id,
            },
          },
        },

        include: {
          workshop: {
            include: {
              presenters: {
                include: {
                  photo: true,
                },
              },
            },
          },
          talk: {
            include: {
              presenters: {
                include: {
                  photo: true,
                },
              },
              category: true,
            },
          },
        },
      });

      if (entity) {
        void EventsService.logEvent(
          "company-application:update",
          ctx.user!.id,
          {
            vat: company.vat,
            chosen,
          },
        );
      }

      return entity;
    }).catch((err) => {
      console.log(err);

      return {
        errors: [
          {
            field: "entity",
            message: "Something went wrong",
          },
        ],
      };
    });

    const errors = (entity as Record<string, unknown>).errors as FieldError[] | undefined;

    if (errors) {
      return {
        errors,
      };
    }

    return {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      entity,
    };
  }

  @Mutation(() => EditApprovedCompanyApplicationResponse, { nullable: true })
  @Authorized()
  async editApprovedCompanyApplication(
    @Ctx() ctx: Context,
      @Arg("info") info: CompanyApplicationApprovedEditInput,
  ): Promise<EditApprovedCompanyApplicationResponse | null> {
    const user = ctx.user!;
    const validation = await CompanyApplicationApprovedValidation(info);

    if (!validation.success) {
      return {
        errors: validation.errors,
      };
    }

    info.vat = info.vat.toUpperCase();

    const isInCompany = user.companies.some((company) => company.vat === info.vat);
    const isAdmin = hasAtLeastRole(Role.Admin, user);

    if (!isInCompany && !isAdmin) {
      return {
        errors: [
          {
            field: "entity",
            message: "You can not edit the company",
          },
        ],
      };
    }

    const currentSeason = await ctx.prisma.season.findFirst({
      where: {
        startsAt: {
          lte: new Date(),
        },
        endsAt: {
          gte: new Date(),
        },
      },
      select: {
        id: true,
        applicationsFrom: true,
        applicationsUntil: true,
      },
    });

    if (!currentSeason) {
      return {
        errors: [
          {
            field: "entity",
            message: "Season is closed",
          },
        ],
      };
    }

    const company = await ctx.prisma.company.findFirst({
      select: {
        applications: {
          select: {
            talk: {
              select: {
                id: true,
                presenters: {
                  select: {
                    id: true,
                    photo: {
                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            },

            workshop: {
              select: {
                id: true,
                presenters: {
                  select: {
                    id: true,
                    photo: {
                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            },

            panelParticipants: {
              select: {
                id: true,
                photo: {
                  select: {
                    id: true,
                  },
                },
              },
            },

            approval: true,
          },
        },
      },
      where: {
        vat: info.vat,
        applications: {
          some: {
            forSeasonId: currentSeason.id,
          },
        },
      },
    });

    if (!company) {
      return {
        errors: [
          {
            field: "entity",
            message: "Company does not exist",
          },
        ],
      };
    }

    const [ application ] = company.applications;

    if (!application) {
      return {
        errors: [
          {
            field: "entity",
            message: "Applications closed",
          },
        ],
      };
    }

    const { approval } = application;

    if (!approval) {
      return {
        errors: [
          {
            field: "entity",
            message: "Applications closed",
          },
        ],
      };
    }

    const data: Prisma.CompanyApplicationUpdateArgs["data"] = {};

    class PresenterCreateError extends Error {
      constructor(
        public readonly field: string,
        message: string,
      ) {
        super(message);
      }
    }

    type PresenterCreate = NonNullable<NonNullable<NonNullable<NonNullable<Prisma.CompanyApplicationUpdateArgs["data"]["workshop"]>["create"]>["presenters"]>["create"]>;

    const createPhoto =
      async (
        eventType: string,
        photoFile: FileUpload | null,
        oldPhoto: { id: number, } | null,
      ): Promise<[ string, null ] | [ null, number ]> => {
        if (photoFile) {
          if (
            !photoMimeTypes.has(photoFile?.mimetype)
            || !photoExtensions.some((ext) => photoFile.filename.endsWith(ext))
          ) {
            return [
              `File must have extension: ${ photoExtensions.join(", ") }`,
              null,
            ];
          }

          const photo = await ImageService.uploadImage(
            `company/${ info.vat }/${ eventType }/presenters` as ImageBase,
            photoFile,
            ctx.user!,
          );

          if (!photo) {
            return [
              "Something went wrong",
              null,
            ];
          }

          return [
            null,
            photo.id,
          ];
        }

        if (oldPhoto) {
          return [
            null,
            oldPhoto.id,
          ];
        }

        return [
          "Photo is required",
          null,
        ];
      }
    ;

    const createPresenters =
      async <T extends keyof typeof application>(
        id: T,
        presenters: PresenterCreateInput[],
        eventName?: string,
      ): Promise<PresenterCreate> => {
        const presentersCreate: PresenterCreate = [];

        for (const presenter of presenters) {
          const i = presenters.indexOf(presenter);
          const presenterCreate: PresenterCreate = {
            ...presenter,
            photo: {
              connect: {
                id: 0,
              },
            },
          };

          const baseId = `${ eventName || id }.presenter.${ i }`;

          const photoFile = await presenter.photo;
          const oldApplication = application[id];
          const oldPhotoPresenters =
            (
              oldApplication
              && "presenters" in oldApplication
            )
              ? oldApplication.presenters[i]?.photo
              : null
          ;
          const oldPhotoEntries =
            (
              oldApplication
              && Array.isArray(oldApplication)
            )
              ? oldApplication[i]?.photo
              : null
          ;
          const oldPhoto = oldPhotoPresenters || oldPhotoEntries;

          const [
            err,
            photoId,
          ] = await createPhoto(
            eventName || id,
            photoFile,
            oldPhoto,
          );

          if (err) {
            throw new PresenterCreateError(
              `${ baseId }.photo`,
              err,
            );
          }

          presenterCreate.photo = {
            connect: {
              id: photoId!,
            },
          };

          presentersCreate.push(presenterCreate);
        }

        return presentersCreate;
      };

    if (0 < approval.talkParticipants) {
      const id = "talk" as const;
      const minPresenters = approval.talkParticipants;

      const entry = info[id]!;

      if (!entry) {
        return {
          errors: [
            {
              field: "entity",
              message: `${ upperFirst(id) } required`,
            },
          ],
        };
      }

      if (entry.presenter.length < minPresenters) {
        return {
          errors: [
            {
              field: "entity",
              message: `At least ${ minPresenters } ${ id } presenters required`,
            },
          ],
        };
      }

      try {
        const presentersCreate: PresenterCreate = await createPresenters(
          id,
          entry.presenter,
        );

        data[id] = {
          update: {
            ...omit(
              [
                "presenter",
                "category",
              ],
              entry,
            ),
            category: {
              connect: {
                name: entry.category,
              },
            },
            presenters: {
              deleteMany: {
                id: {
                  in: application[id]?.presenters.map((p) => p.id) || [],
                },
              },
              create: presentersCreate,
            },
          },
        };
      } catch (e) {
        if (e instanceof PresenterCreateError) {
          return {
            errors: [
              {
                field: e.field,
                message: e.message,
              },
            ],
          };
        }

        throw e;
      }
    }

    if (0 < approval.workshopParticipants) {
      const id = "workshop" as const;
      const minPresenters = approval.workshopParticipants;

      const entry = info[id]!;

      if (!entry) {
        return {
          errors: [
            {
              field: "entity",
              message: `${ upperFirst(id) } required`,
            },
          ],
        };
      }

      if (entry.presenter.length < minPresenters) {
        return {
          errors: [
            {
              field: "entity",
              message: `At least ${ minPresenters } ${ id } presenters required`,
            },
          ],
        };
      }

      try {
        const presentersCreate: PresenterCreate = await createPresenters(
          id,
          entry.presenter,
        );

        data[id] = {
          update: {
            ...omit(
              [
                "presenter",
              ],
              entry,
            ),
            presenters: {
              deleteMany: {
                id: {
                  in: application[id]?.presenters.map((p) => p.id) || [],
                },
              },
              create: presentersCreate,
            },
          },
        };
      } catch (e) {
        if (e instanceof PresenterCreateError) {
          return {
            errors: [
              {
                field: e.field,
                message: e.message,
              },
            ],
          };
        }

        throw e;
      }
    }

    if (approval.panel) {
      const id = "panel" as const;
      const minPresenters = 1;

      const entry = info[id]!;

      if (!entry) {
        return {
          errors: [
            {
              field: "entity",
              message: `${ upperFirst(id) } required`,
            },
          ],
        };
      }

      if (entry.length < minPresenters) {
        return {
          errors: [
            {
              field: "entity",
              message: `At least ${ minPresenters } ${ id } presenters required`,
            },
          ],
        };
      }

      try {
        const presentersCreate: PresenterCreate = await createPresenters(
          "panelParticipants" as const,
          entry,
          "panel",
        );

        data.panelParticipants = {
          deleteMany: {
            id: {
              in: application.panelParticipants.map((p) => p.id) || [],
            },
          },
          create: presentersCreate,
        };
      } catch (e) {
        if (e instanceof PresenterCreateError) {
          return {
            errors: [
              {
                field: e.field,
                message: e.message,
              },
            ],
          };
        }

        throw e;
      }
    }

    if (approval.cocktail) {
      const id = "cocktail" as const;

      const entry = info[id];

      if (!entry) {
        return {
          errors: [
            {
              field: "entity",
              message: `${ upperFirst(id) } required`,
            },
          ],
        };
      }

      data[id] = {
        upsert: {
          create: {
            ...entry,
          },
          update: {
            ...entry,
          },
        },
      };
    }

    const entity = await ctx.prisma.companyApplication.update({
      data,
      where: {
        id: approval.forApplicationId,
      },
      include: {
        workshop: {
          include: {
            presenters: {
              include: {
                photo: true,
              },
            },
          },
        },
        talk: {
          include: {
            presenters: {
              include: {
                photo: true,
              },
            },
            category: true,
          },
        },
        panelParticipants: {
          include: {
            photo: true,
          },
        },
        cocktail: true,
      },
    });

    if (entity) {
      void EventsService.logEvent(
        "company-application:approved:update",
        ctx.user!.id,
        {
          vat: info.vat,
        },
      );
    }

    return {
      entity,
    };
  }
}
