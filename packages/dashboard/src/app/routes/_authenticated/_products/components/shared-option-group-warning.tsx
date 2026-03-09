import { Alert, AlertDescription } from '@/vdb/components/ui/alert.js';
import { PageBlock } from '@/vdb/framework/layout-engine/page-layout.js';
import { Plural } from '@lingui/react/macro';
import { TriangleAlert } from 'lucide-react';

export function SharedOptionGroupWarning({ productCount }: Readonly<{ productCount: number }>) {
    if (productCount <= 1) {
        return null;
    }
    return (
        <PageBlock column="main" blockId="shared-warning">
            <Alert>
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>
                    <Plural
                        value={productCount}
                        one="This option group is used by one other product. Changes will affect it too."
                        other="This option group is shared across # products. Changes will affect all of them."
                    />
                </AlertDescription>
            </Alert>
        </PageBlock>
    );
}
