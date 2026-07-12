import { NotFoundException } from "@nestjs/common";

type ExistsDelegate = {
    findUnique(args: { where: { id: number }; select?: { id: true } }): Promise<{ id: number } | null>;
};

export async function assertEntityExists(
    delegate: ExistsDelegate,
    entityName: string,
    id: number,
) {
    const entity = await delegate.findUnique({
        where: { id },
        select: { id: true },
    });

    if (!entity) {
        throw new NotFoundException(`${entityName} with ID ${id} not found`);
    }

    return entity;
}
