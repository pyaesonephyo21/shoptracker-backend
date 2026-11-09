<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use App\Services\SkuGeneratorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SkuGeneratorServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_generate_acronym_extracts_clean_initials_for_multi_word_names(): void
    {
        $service = new SkuGeneratorService;

        $this->assertSame('CCTS', $service->generateAcronym('Cotton Crewneck T-Shirt'));
        $this->assertSame('VWOS', $service->generateAcronym('Vintage Washed Oversized Shirt'));
    }

    public function test_generate_acronym_for_two_word_names(): void
    {
        $service = new SkuGeneratorService;

        $this->assertSame('BLHO', $service->generateAcronym('Black Hoodie'));
        $this->assertSame('CABA', $service->generateAcronym('Canvas Bag'));
    }

    public function test_generate_acronym_for_single_word_names(): void
    {
        $service = new SkuGeneratorService;

        $this->assertSame('HOOD', $service->generateAcronym('Hoodie'));
        $this->assertSame('JEAN', $service->generateAcronym('Jeans'));
        $this->assertSame('CAP', $service->generateAcronym('Cap'));
    }

    public function test_generate_acronym_falls_back_gracefully_for_burmese_or_non_latin_text(): void
    {
        $service = new SkuGeneratorService;

        $this->assertSame('APP', $service->generateAcronym('ချည်သား အင်္ကျီ', 'Apparel'));
        $this->assertSame('PRD', $service->generateAcronym('ချည်သား အင်္ကျီ', null));
    }

    public function test_resolve_next_sequence_increments_for_similar_products_in_same_shop(): void
    {
        $shop = Shop::create(['name' => 'Fashion Hub']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $service = new SkuGeneratorService;

        // When no existing product exists, sequence is 01
        $this->assertSame('01', $service->resolveNextSequence('CTS', $shop->id));

        $product1 = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Cotton T-Shirt 1',
            'type' => 'local',
        ]);

        ProductVariant::create([
            'product_id' => $product1->id,
            'sku' => 'CTS01-BLK-M',
        ]);

        // When CTS01 exists, next sequence is 02
        $this->assertSame('02', $service->resolveNextSequence('CTS', $shop->id));

        $product2 = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Cotton T-Shirt 2',
            'type' => 'local',
        ]);

        ProductVariant::create([
            'product_id' => $product2->id,
            'sku' => 'CTS02-BLK-L',
        ]);

        // When CTS01 and CTS02 exist, next sequence is 03
        $this->assertSame('03', $service->resolveNextSequence('CTS', $shop->id));
    }

    public function test_generate_variant_sku_dynamically_formats_actual_input_data(): void
    {
        $service = new SkuGeneratorService;

        $this->assertSame(
            'CTS01-RED-M',
            $service->generateVariantSku('CTS01', ['color' => 'Red', 'size' => 'M'])
        );

        $this->assertSame(
            'CTS01-BLACK-XL',
            $service->generateVariantSku('CTS01', ['color' => 'Black', 'size' => 'XL'])
        );

        $this->assertSame(
            'CTS01-NAVYBLUE-32',
            $service->generateVariantSku('CTS01', ['color' => 'Navy Blue', 'size' => '32'])
        );

        $this->assertSame(
            'CTS01-256GB',
            $service->generateVariantSku('CTS01', ['storage' => '256 GB'])
        );

        $this->assertSame(
            'CTS01-အနီ',
            $service->generateVariantSku('CTS01', ['color' => 'အနီ'])
        );

        $this->assertSame(
            'CTS01-DEF',
            $service->generateVariantSku('CTS01', [])
        );
    }
}
