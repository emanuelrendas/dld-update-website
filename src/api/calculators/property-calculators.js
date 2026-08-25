/**
 * RAIOC OS - Property & Investment Calculators
 * All calculations consume live statutory assumptions, tax rules, and community yields from the Institutional Knowledge Layer (IKL v1.0).
 */

import { ikl } from '../../core/ikl/index.js';

export class PropertyCalculators {
  constructor(options = {}) {
    this.ikl = options.ikl || ikl;
  }

  /**
   * Calculates total property acquisition costs including DLD transfer fee, admin, agency, and trustee fees.
   * @param {Object} params - { propertyPriceAed, isOffPlan, includeMortgage, mortgageAmountAed }
   * @returns {Object} Detailed acquisition cost breakdown with IKL provenance
   */
  calculateAcquisitionCost(params = {}) {
    const price = Number(params.propertyPriceAed || params.price || 0);
    const isOffPlan = Boolean(params.isOffPlan);
    const mortgageAmount = Number(params.mortgageAmountAed || 0);

    // Fetch live tax & regulatory assumptions from IKL
    const dldRule = this.ikl.getTaxRule('tax_dld_transfer_fee') || { ratePercent: 4.0 };
    const vatRule = this.ikl.getTaxRule('tax_vat_real_estate') || { commercialRatePercent: 5.0 };

    const dldFee = price * (dldRule.ratePercent / 100);
    const dldAdminFee = isOffPlan ? 580 : 4200; // Oqood (AED 580) vs Title Deed issuance (AED 4,000 + 5% VAT)
    const agencyFeePercent = 2.0;
    const agencyFee = price * (agencyFeePercent / 100);
    const agencyVat = agencyFee * (vatRule.commercialRatePercent / 100);
    
    // Mortgage registration fee: 0.25% of mortgage amount + AED 290
    const mortgageRegFee = mortgageAmount > 0 ? (mortgageAmount * 0.0025) + 290 : 0;
    const trusteeFee = price >= 500000 ? 4200 : 2100; // Registration trustee fee

    const totalGovernmentFees = dldFee + dldAdminFee + mortgageRegFee + trusteeFee;
    const totalProfessionalFees = agencyFee + agencyVat;
    const totalAcquisitionCosts = totalGovernmentFees + totalProfessionalFees;
    const totalOutlay = price + totalAcquisitionCosts;

    const confidence = this.ikl.getConfidence('tax_dld_transfer_fee', {
      matchedCount: 3,
      expectedCount: 3,
    });

    return {
      propertyPriceAed: price,
      breakdown: {
        dldTransferFee: dldFee,
        dldRatePercent: dldRule.ratePercent,
        dldAdminFee,
        trusteeFee,
        mortgageRegistrationFee: mortgageRegFee,
        agencyFee,
        agencyVat,
        totalGovernmentFees,
        totalProfessionalFees,
        totalAcquisitionCosts,
      },
      totalOutlayAed: totalOutlay,
      costPercentageOfPurchase: price > 0 ? Number(((totalAcquisitionCosts / price) * 100).toFixed(2)) : 0,
      confidence,
      provenance: dldRule.provenance,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates Golden Visa qualification and investment equity status
   * @param {Object} params - { totalPropertyEquityAed, propertyCount }
   * @returns {Object} Golden Visa qualification assessment with IKL provenance
   */
  calculateGoldenVisaEligibility(params = {}) {
    const equity = Number(params.totalPropertyEquityAed || params.equity || 0);
    const propertyCount = Number(params.propertyCount || 1);

    // Fetch statutory Golden Visa regulation from IKL
    const gvRule = this.ikl.getRegulation('reg_golden_visa_property') || { thresholdAed: 2000000 };
    const threshold = gvRule.thresholdAed || 2000000;

    const isEligible = equity >= threshold;
    const deficitAed = Math.max(0, threshold - equity);
    const progressPercent = Math.min(100, Number(((equity / threshold) * 100).toFixed(1)));

    const confidence = this.ikl.getConfidence('reg_golden_visa_property', {
      matchedCount: 2,
      expectedCount: 2,
    });

    return {
      isEligible,
      qualifyingThresholdAed: threshold,
      currentEquityAed: equity,
      progressPercent,
      deficitAed,
      visaType: '10-Year Renewable UAE Golden Visa',
      benefits: [
        '100% foreign business ownership without local sponsor',
        'Sponsorship of spouse, children (no age cap for unmarried sons/daughters), and domestic staff',
        'No maximum limit on stay outside the UAE to maintain residency validity',
        'Access to UAE banking, tax residency certificate, and Emirates ID',
      ],
      confidence,
      provenance: gvRule.provenance,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates Net & Gross Rental Yield and comparison between Long-Term and Short-Term Holiday Home Arbitrage
   * @param {Object} params - { communityId, propertyPriceAed, annualRentAed, isShortTerm }
   * @returns {Object} Yield arbitrage modeling with IKL community benchmarks
   */
  calculateRentalYield(params = {}) {
    const price = Number(params.propertyPriceAed || 1500000);
    const community = params.communityId ? this.ikl.getCommunity(params.communityId) : null;

    const defaultGrossYield = community ? community.avgGrossYield : 7.0;
    const defaultNetYield = community ? community.avgNetYield : 5.8;

    const longTermAnnualRent = Number(params.annualRentAed || (price * (defaultGrossYield / 100)));
    const serviceChargesPerSqFt = Number(params.serviceChargesPerSqFt || 18);
    const propertySqFt = Number(params.propertySqFt || 1000);
    const annualServiceCharges = serviceChargesPerSqFt * propertySqFt;

    // Long-Term Modeling
    const longTermGrossYield = (longTermAnnualRent / price) * 100;
    const longTermManagementFee = longTermAnnualRent * 0.05; // 5% property management
    const longTermMaintenance = longTermAnnualRent * 0.02;  // 2% sinking fund
    const longTermNetIncome = longTermAnnualRent - annualServiceCharges - longTermManagementFee - longTermMaintenance;
    const longTermNetYield = (longTermNetIncome / price) * 100;

    // Short-Term Holiday Home Modeling (Typically 20-35% higher gross, 18-20% operator fee)
    const shortTermGrossRevenue = longTermAnnualRent * 1.28;
    const shortTermOperatorFee = shortTermGrossRevenue * 0.18; // 18% holiday home operator
    const shortTermUtilitiesAndDewa = 12000;
    const shortTermNetIncome = shortTermGrossRevenue - annualServiceCharges - shortTermOperatorFee - shortTermUtilitiesAndDewa;
    const shortTermNetYield = (shortTermNetIncome / price) * 100;

    return {
      propertyPriceAed: price,
      community: community ? { id: community.id, name: community.name } : null,
      longTerm: {
        annualGrossRentAed: Math.round(longTermAnnualRent),
        annualNetIncomeAed: Math.round(longTermNetIncome),
        grossYieldPercent: Number(longTermGrossYield.toFixed(2)),
        netYieldPercent: Number(longTermNetYield.toFixed(2)),
      },
      shortTermArbitrage: {
        annualGrossRevenueAed: Math.round(shortTermGrossRevenue),
        annualNetIncomeAed: Math.round(shortTermNetIncome),
        grossYieldPercent: Number((shortTermGrossRevenue / price * 100).toFixed(2)),
        netYieldPercent: Number(shortTermNetYield.toFixed(2)),
        arbitrageSpreadAed: Math.round(shortTermNetIncome - longTermNetIncome),
      },
      annualServiceChargesAed: annualServiceCharges,
      benchmarkCommunityGrossYield: defaultGrossYield,
      benchmarkCommunityNetYield: defaultNetYield,
      calculatedAt: new Date().toISOString(),
    };
  }
}

export const propertyCalculators = new PropertyCalculators();
