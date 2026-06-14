<template>
  <div class="home">
    <HeroSection />
    <HowItWorksSection />
    <ExamplesSection />
    <BenefitsSection />
    <ReviewsSection />
    <FAQSection />
    <CTASection />
  </div>
</template>

<script setup lang="ts">
import BenefitsSection from '@/components/home/BenefitsSection.vue'
import CTASection from '@/components/home/CTASection.vue'
import ExamplesSection from '@/components/home/ExamplesSection.vue'
import FAQSection from '@/components/home/FAQSection.vue'
import HeroSection from '@/components/home/HeroSection.vue'
import HowItWorksSection from '@/components/home/HowItWorksSection.vue'
import ReviewsSection from '@/components/home/ReviewsSection.vue'
</script>

<style scoped lang="scss">
.home {
  background-color: $bg-primary;
}
</style>
